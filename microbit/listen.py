#!/usr/bin/env python3
"""Print what a micro:bit is sending, straight from the terminal.

    python3 microbit/listen.py

Useful for checking a board without opening the browser at all - handy when
you are working through a class set and want to know which ones are flashed.
Stdlib only, no pip install. macOS and Linux; on Windows use rattle's own
micro:bit panel instead.
"""

import glob
import os
import select
import sys
import termios
import time
import tty

BAUD = 115200


def find_port():
    # The micro:bit's DAPLink shows up as a usbmodem/ttyACM device.
    for pattern in ('/dev/cu.usbmodem*', '/dev/ttyACM*'):
        ports = sorted(glob.glob(pattern))
        if ports:
            return ports[0]
    return None


def main():
    port = sys.argv[1] if len(sys.argv) > 1 else find_port()
    if not port:
        print('No micro:bit found. Is it plugged in?')
        print('Ports that do exist:', ', '.join(sorted(glob.glob('/dev/cu.*'))) or 'none')
        return 1

    print(f'Listening to {port} at {BAUD}. Ctrl-C to stop.\n')
    try:
        fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    except OSError as e:
        # A serial port has exactly one owner. If rattle is connected in the
        # browser, it holds this port and nothing else can read it - which is
        # worth saying plainly, because "Resource busy" is not a clue.
        if e.errno == 16:
            print('That port is already open somewhere else.')
            print('If rattle has the board connected in the browser, click')
            print('micro:bit in the header to disconnect, then try again.')
            return 1
        print(f'Could not open {port}: {e}')
        return 1
    try:
        # Full raw mode. Clearing a few flags by hand is not enough: the line
        # discipline still mangles the stream, and the symptom is a character
        # missing here and there rather than an obvious failure.
        tty.setraw(fd)
        attrs = termios.tcgetattr(fd)
        attrs[4] = attrs[5] = termios.B115200
        attrs[6][termios.VMIN] = 0
        attrs[6][termios.VTIME] = 0
        termios.tcsetattr(fd, termios.TCSANOW, attrs)
        termios.tcflush(fd, termios.TCIFLUSH)

        buf = b''
        seen = 0
        started = time.time()
        while True:
            ready, _, _ = select.select([fd], [], [], 0.2)
            if ready:
                try:
                    buf += os.read(fd, 4096)
                except OSError:
                    pass
            while b'\n' in buf:
                line, buf = buf.split(b'\n', 1)
                seen += 1
                print(' ', line.decode('utf-8', 'replace').rstrip(), flush=True)
            if seen == 0 and time.time() - started > 3:
                print('Nothing yet after 3s. The board is probably not flashed,')
                print('or is running a program that does not print.')
                print('Flash microbit/controller.py at https://python.microbit.org')
                started = float('inf')
    except KeyboardInterrupt:
        print('\nstopped')
    finally:
        os.close(fd)
    return 0


if __name__ == '__main__':
    sys.exit(main())
