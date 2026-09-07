"""Pruebas de integración contra una instancia local aislada (MySQL + API PHP)."""
import http.cookiejar
import json
import os
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get('EXP_IMCYC_TEST_URL', 'http://127.0.0.1:4187/exp-imcyc/')
assert urllib.parse.urlparse(BASE).hostname in ('127.0.0.1', 'localhost'), 'Usar solo una instancia local de pruebas.'
ORIGIN = 'http://' + urllib.parse.urlparse(BASE).netloc
MISSING = object()
checks = 0


class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.csrf = None

    def call(self, action, body=MISSING, expected=200, query=None, headers=None, method=None):
        global checks
        parameters = {'action': action, **(query or {})}
        request_headers = {'Origin': ORIGIN}
        payload = None
        if body is not MISSING:
            payload = json.dumps(body).encode()
            request_headers.update({'Content-Type': 'application/json', 'X-CSRF-Token': self.csrf or ''})
        request_headers.update(headers or {})
        request = urllib.request.Request(BASE + 'api/index.php?' + urllib.parse.urlencode(parameters), data=payload, headers=request_headers, method=method)
        try:
            response = self.opener.open(request)
        except urllib.error.HTTPError as error:
            response = error
        result = json.load(response)
        assert response.status == expected, (action, expected, response.status, result)
        assert 'no-store' in response.headers.get('Cache-Control', ''), 'La API no debe almacenar datos personales en caché.'
        self.csrf = result.get('csrf', self.csrf)
        checks += 1
        return result


anonymous = Client()
anonymous.call('admin.registrations', expected=401)
anonymous.call('login', {'username': 'qa', 'password': 'invalid'}, expected=403)
anonymous.call('session')
anonymous.call('login', {'username': 'qa', 'password': 'invalid'}, expected=401)
anonymous.call('registration.save', {}, expected=403, headers={'Origin': 'https://example.com'})
anonymous.call('registration.save', {}, expected=422)
anonymous.call('survey.submit', {'service': 'Certificación', 'application': 'Calidad', 'clarity': 'Buena', 'serviceRating': 0}, expected=409)
anonymous.call('session', {}, expected=405)
anonymous.call('nonexistent', expected=404)
anonymous.call('registration.save', {'name': 'a' * 33000}, expected=413)

participant = Client()
participant.call('session')
identity = {'name': 'María Ramírez', 'company': 'Laboratorio de prueba', 'email': 'maria.qa@example.com'}
participant.call('registration.save', identity)
pending = participant.call('registration.current')['registration']
assert pending['completed_at'] is None and pending['email'] == identity['email']
participant.call('registration.save', {**identity, 'company': 'IMCYC - QA'})
updated = participant.call('registration.current')['registration']
assert pending['id'] == updated['id'] and updated['company'] == 'IMCYC - QA'
assert anonymous.call('registration.current')['registration'] is None
assert anonymous.call('registration.current', query={'id': pending['id']})['registration'] is None

survey = {'service': 'Certificación', 'application': 'Control del concreto y aplicación de normas.', 'clarity': 'Buena', 'serviceRating': 0}
participant.call('survey.submit', {**survey, 'serviceRating': '0'}, expected=422)
first = participant.call('survey.submit', survey)
repeated = participant.call('survey.submit', {**survey, 'serviceRating': 5, 'service': 'Diplomado'})
assert first['code'] == repeated['code'] and first['issuedAt'] == repeated['issuedAt']
completed = participant.call('registration.current')['registration']
assert completed['service_rating'] == 0 and completed['service'] == 'Certificación'
assert completed['application'] == survey['application'] and completed['clarity'] == 'Buena'
participant.call('registration.save', identity, expected=409)

admin = Client()
admin.call('session')
old_csrf = admin.csrf
admin.call('login', {'username': 'qa', 'password': os.environ.get('EXP_IMCYC_TEST_PASSWORD', 'Clave-QA-local-2026')})
assert admin.csrf != old_csrf
assert all(cookie.has_nonstandard_attr('HttpOnly') for cookie in admin.cookies)
listing = admin.call('admin.registrations', query={'search': identity['email']})
assert listing['total'] == 1 and listing['registrations'][0]['id'] == pending['id']
assert admin.call('admin.registrations', query={'search': "' OR 1=1 --"})['total'] == 0
assert admin.call('admin.registrations', query={'search': '%'})['total'] == 0
admin.call('admin.registrations', query={'page': '-1'}, expected=422)

second = Client()
second.call('session')
second.call('registration.save', {**identity, 'name': 'Otro participante con el mismo correo'})
assert second.call('registration.current')['registration']['id'] != pending['id']
assert admin.call('admin.registrations', query={'search': identity['email']})['total'] == 2

for index in range(26):
    second.call('registration.reset', {})
    second.call('registration.save', {'name': f'Participante de prueba {index + 1:02d}', 'company': 'Verificación del panel', 'email': f'qa-pagination-{index}@example.com'})

page_one = admin.call('admin.registrations', query={'search': 'qa-pagination', 'page': '1'})
page_two = admin.call('admin.registrations', query={'search': 'qa-pagination', 'page': '2'})
assert page_one['total'] == 26 and len(page_one['registrations']) == 25 and len(page_two['registrations']) == 1
assert not ({row['id'] for row in page_one['registrations']} & {row['id'] for row in page_two['registrations']})
pending_list = admin.call('admin.registrations', query={'status': 'pending'})
assert all(row['completed_at'] is None for row in pending_list['registrations'])
completed_list = admin.call('admin.registrations', query={'status': 'completed', 'service': 'Certificación'})
assert completed_list['total'] == 1 and completed_list['stats']['averageRating'] == 0

admin.call('logout', {})
admin.call('admin.registrations', expected=401)
limiter = Client()
limiter.call('session')
for _ in range(10):
    limiter.call('login', {'username': 'missing-user', 'password': 'invalid'}, expected=401)
limiter.call('login', {'username': 'missing-user', 'password': 'invalid'}, expected=429)
print(f'{checks} solicitudes verificadas: autenticación, CSRF, aislamiento, validación, idempotencia, filtros, paginación y límite de intentos.')
