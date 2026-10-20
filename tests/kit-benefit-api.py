"""Benefit persistence, historical kits and retries against a synthetic local DB."""
import hashlib
import hmac
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

fixture_path = Path(os.environ['EXP_IMCYC_KIT_QA_FILE'])
assert fixture_path.stat().st_mode & 0o077 == 0
fixture = json.loads(fixture_path.read_text())
assert fixture['synthetic'] and fixture['database'].startswith('imcyc_exp_bridge_qa_')
base = fixture['baseUrl']
assert urllib.parse.urlsplit(base).hostname in ['127.0.0.1', 'localhost']
checks = 0


def send(request, expected=200, opener=None):
    global checks
    try:
        response = (opener or urllib.request).open(request, timeout=15) if opener else urllib.request.urlopen(request, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    result = json.load(response)
    assert response.status == expected, (response.status, expected, result)
    assert 'no-store' in response.headers.get('Cache-Control', '')
    checks += 1
    return result


def bridge(action, params=None, expected=200):
    body = json.dumps({'action': action, 'params': params or {}}, ensure_ascii=False, separators=(',', ':')).encode()
    timestamp, nonce = str(int(time.time())), secrets.token_hex(32)
    signature = hmac.new(fixture['secret'].encode(), timestamp.encode()+b'\n'+nonce.encode()+b'\n'+body, hashlib.sha256).hexdigest()
    return send(urllib.request.Request(base+'api/cms.php', data=body, headers={
        'Content-Type': 'application/json', 'X-IMCYC-CMS-Timestamp': timestamp,
        'X-IMCYC-CMS-Nonce': nonce, 'X-IMCYC-CMS-Signature': signature,
    }), expected)


class Participant:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = self.call('session')['csrf']

    def call(self, action, body=None, expected=200):
        headers = {'Origin': 'http://127.0.0.1:4388'}
        if body is not None: headers.update({'Content-Type': 'application/json', 'X-CSRF-Token': self.csrf})
        return send(urllib.request.Request(base+'api/index.php?action='+action,
            data=None if body is None else json.dumps(body).encode(), headers=headers), expected, self.opener)

    def complete(self):
        self.call('registration.save', {'name': 'Participante QA', 'company': 'Empresa ficticia', 'email': secrets.token_hex(4)+'@example.test'})
        return self.call('survey.submit', survey)


survey = {'service': 'Certificación', 'application': 'Aplicación de prueba.', 'clarity': 'Buena', 'serviceRating': 0, 'opinionConsent': False}
original = bridge('kit.get')
assert original['benefit']['benefit'] == '10% DE DESCUENTO'
legacy = bridge('registrations.detail', {'id': fixture['legacyId']})['registration']
assert legacy['benefit'] == original['benefit'] and 'kit_snapshot' not in legacy
first = Participant()
first_kit = first.complete()
assert first_kit['benefit'] == original['benefit']
updated = {**original['benefit'], 'benefit': 'PUBLICACIÓN DIGITAL DE OBSEQUIO', 'description': 'UNA GUÍA DE TECNOLOGÍA DEL CONCRETO', 'validityDays': 60, 'email': 'qa@example.test'}
current = bridge('kit.save', {'revision': original['revision'], 'benefit': updated})
assert current['revision'] == original['revision']+1 and current['benefit'] == updated
bridge('kit.save', {'revision': original['revision'], 'benefit': original['benefit']}, 409)
assert bridge('kit.get') == current
for field, values in {
    'title': ['', 'a'*46, 'Título\nsegunda línea'], 'benefit': ['', 'a'*71], 'description': ['a'*141],
    'conditions': ['', 'a'*361], 'validityDays': [0, 366, '30', 1.5, True],
    'email': ['sin-correo', 'a@example.test\nBcc:foo@example.test'], 'whatsapp': ['javascript:alert(1)', '123', '1'*16],
}.items():
    for value in values:
        bridge('kit.save', {'revision': current['revision'], 'benefit': {**updated, field: value}}, 422)
assert bridge('kit.get') == current
assert bridge('registrations.detail', {'id': fixture['legacyId']})['registration']['benefit'] == original['benefit']
assert first.call('registration.current')['registration']['benefit'] == original['benefit']
assert first.call('survey.submit', {**survey, 'serviceRating': 5}) == first_kit
second = Participant()
second_kit = second.complete()
assert second_kit['benefit'] == updated
record = second.call('registration.current')['registration']
assert record['benefit'] == updated and record['service_rating'] == 0 and record['opinion_consent'] is False
assert bridge('registrations.detail', {'id': record['id']})['registration']['benefit'] == updated
listed = bridge('registrations.list')['registrations']
assert next(row for row in listed if row['id'] == record['id'])['benefit'] == updated
first.call('kit.save', expected=404)
send(urllib.request.Request(base+'api/cms.php', data=b'{}', headers={'Content-Type': 'application/json'}), 401)
bridge('kit.save', {'revision': current['revision'], 'benefit': original['benefit']})
assert second.call('survey.submit', survey) == second_kit
print(f'{checks} HTTP checks passed: configurable benefit, validation, conflicts, immutable issued kits, retries and session isolation.')
