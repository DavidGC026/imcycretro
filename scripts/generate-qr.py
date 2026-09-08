"""Genera el QR público de acceso al registro y la encuesta de satisfacción."""
from pathlib import Path

import qrcode
from qrcode.image.svg import SvgPathFillImage

URL = 'https://grabador.imcyc.com/exp-imcyc/'
destination = Path(__file__).resolve().parent.parent / 'public'
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, box_size=24, border=4)
qr.add_data(URL)
qr.make(fit=True)
qr.make_image(fill_color='black', back_color='white').save(destination / 'qr-encuesta-satisfaccion.png')
qr.make_image(image_factory=SvgPathFillImage).save(destination / 'qr-encuesta-satisfaccion.svg')
print(f'QR PNG y SVG guardados en {destination}. Enlace: {URL}')
