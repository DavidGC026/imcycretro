"""Verify the actual PDF geometry after running scripts/pdf-sample.mjs."""
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET

pdf = Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/pdfs/kit-beneficio-extenso.pdf')
tree = ET.fromstring(subprocess.check_output(['pdftotext', '-bbox', str(pdf), '-']))
words = [{'text': node.text or '', **{key: float(node.attrib[key]) for key in ['xMin', 'xMax', 'yMin', 'yMax']}}
         for node in tree.iter() if node.tag.endswith('}word')]


def bounds(text):
    tokens = text.split()
    for index in range(len(words) - len(tokens) + 1):
        group = words[index:index + len(tokens)]
        if [word['text'] for word in group] == tokens:
            return min(word['yMin'] for word in group), max(word['yMax'] for word in group)
    raise AssertionError('PDF text missing or interleaved: ' + text[:60])


heading = bounds('UNA PUBLICACIÓN DIGITAL Y ACCESO A UNA SESIÓN TÉCNICA EXCLUSIVA')
description = bounds('Recibe material técnico especializado para aplicar el conocimiento del concreto en tu trabajo y continuar con tu desarrollo profesional.')
email = bounds('coordinacion-de-capacitacion-y-desarrollo-profesional@example.test')
conditions_text = ('Beneficio personal sujeto a disponibilidad. Solicitar por correo y presentar el folio al registrarse. No se acumula con otras promociones. ' * 3)[:360]
conditions = bounds('Válido 365 días naturales a partir de la fecha de emisión. ' + conditions_text)
footer = bounds('Instituto Mexicano del Cemento y del Concreto A.C.')
assert heading[0] >= 200 and heading[1] + 4 < description[0], (heading, description)
assert description[1] < 310, description
assert email[1] + 4 < conditions[0], (email, conditions)
assert conditions[1] + 1 < footer[0], (conditions, footer)
assert all(word['xMin'] >= 25 and word['xMax'] <= 551 for word in words), 'Text outside page margins'
assert bounds('EJEMPLO - SIN VALIDEZ')[0] < 192
print('6 PDF layout checks passed: complete text, separate benefit and description, contacts, terms, margins and example mark.')
