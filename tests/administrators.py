"""Pruebas locales de creación, cambio de claves y revocación de sesiones."""
import http.cookiejar
import http.client
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get('EXP_IMCYC_TEST_URL', 'http://127.0.0.1:4187/exp-imcyc/')
assert urllib.parse.urlparse(BASE).hostname in ('localhost', '127.0.0.1'), 'Usar solo una instancia local de pruebas.'
ORIGIN = 'http://' + urllib.parse.urlparse(BASE).netloc
ADMIN_PASSWORD = os.environ.get('EXP_IMCYC_TEST_PASSWORD', 'Clave-QA-local-2026')
checks = 0


class LocalConnection(http.client.HTTPConnection):
    def __init__(self, *args, **kwargs):
        # Aislar el límite por IP de esta suite del de tests/api.py.
        super().__init__(*args, source_address=('127.0.0.2', 0), **kwargs)


class LocalHandler(urllib.request.HTTPHandler):
    def http_open(self, request):
        return self.do_open(LocalConnection, request)


class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(LocalHandler(), urllib.request.HTTPCookieProcessor(self.cookies))
        self.csrf = ''
        self.call('session')

    def call(self, action, body=None, expected=200, headers=None):
        global checks
        request_headers = {'Origin': ORIGIN}
        if body is not None:
            request_headers.update({'Content-Type': 'application/json', 'X-CSRF-Token': self.csrf})
        request_headers.update(headers or {})
        request = urllib.request.Request(BASE + 'api/index.php?action=' + action, data=json.dumps(body).encode() if body is not None else None, headers=request_headers)
        try:
            response = self.opener.open(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        result = json.load(response)
        assert response.status == expected, (action, expected, response.status, result)
        self.csrf = result.get('csrf', self.csrf)
        checks += 1
        return result

    def login(self, username, password, expected=200):
        return self.call('login', {'username': username, 'password': password}, expected)


anonymous = Client()
anonymous.call('admin.users', expected=401)
anonymous.call('admin.users.create', {}, expected=401)
anonymous.call('admin.users.password', {}, expected=401)

admin = Client()
admin.login('qa', ADMIN_PASSWORD)
users = admin.call('admin.users')['users']
assert any(user['username'] == 'qa' and user['isCurrent'] for user in users)
assert all(set(user) == {'id', 'username', 'created_at', 'isCurrent'} for user in users)
username = 'equipo-' + secrets.token_hex(4)
initial_password = 'Contraseña inicial de prueba - 2026'
create = {'username': username, 'newPassword': initial_password, 'confirmPassword': initial_password, 'currentPassword': ADMIN_PASSWORD}
admin.call('admin.users.create', create, expected=403, headers={'X-CSRF-Token': 'invalid'})
admin.call('admin.users.create', create, expected=403, headers={'Origin': 'https://example.com'})
admin.call('admin.users.create', {**create, 'currentPassword': 'incorrecta'}, expected=422)
admin.call('admin.users.create', {**create, 'confirmPassword': 'No coincide con la nueva'}, expected=422)
admin.call('admin.users.create', {**create, 'newPassword': 'corta', 'confirmPassword': 'corta'}, expected=422)
admin.call('admin.users.create', {**create, 'username': '../admin'}, expected=422)
admin.call('admin.users.create', create)
admin.call('admin.users.create', {**create, 'username': username.upper()}, expected=409)
created = next(user for user in admin.call('admin.users')['users'] if user['username'] == username)
assert not created['isCurrent']

owner = Client()
owner.login(username, initial_password)
other_session = Client()
other_session.login(username, initial_password)
assert any(user['id'] == created['id'] and user['isCurrent'] for user in owner.call('admin.users')['users'])

# La contraseña excede 72 bytes; no debe truncarse ni aceptar otra terminación.
new_password = 'á' * 50 + ' nueva frase de prueba'
change = {'id': created['id'], 'newPassword': new_password, 'confirmPassword': new_password, 'currentPassword': initial_password}
owner.call('admin.users.password', {**change, 'id': str(created['id'])}, expected=422)
owner.call('admin.users.password', {**change, 'currentPassword': 'incorrecta'}, expected=422)
owner.call('admin.users.password', {**change, 'id': 2147483647}, expected=404)
old_csrf = owner.csrf
old_cookie = next(cookie.value for cookie in owner.cookies if cookie.name == 'exp_imcyc_session')
owner.call('admin.users.password', change)
assert owner.csrf != old_csrf
assert next(cookie.value for cookie in owner.cookies if cookie.name == 'exp_imcyc_session') != old_cookie
assert owner.call('session')['authenticated']
owner.call('admin.users')
other_session.call('admin.users', expected=401)
assert not other_session.call('session')['authenticated']

probe = Client()
probe.login(username, initial_password, expected=401)
probe.login(username, 'á' * 50 + ' terminación diferente', expected=401)
probe.login(username, new_password)
probe.call('admin.users.password', {**change, 'currentPassword': new_password}, expected=422)

reset_password = 'Nueva contraseña del equipo 2026'
admin.call('admin.users.password', {'id': created['id'], 'newPassword': reset_password, 'confirmPassword': reset_password, 'currentPassword': ADMIN_PASSWORD})
owner.call('admin.users', expected=401)
assert not probe.call('session')['authenticated']
probe.login(username, new_password, expected=401)
probe.login(username, reset_password)
probe.call('admin.registrations')
probe.call('logout', {})
probe.call('admin.users', expected=401)
admin.call('admin.users')
print(f'{checks} solicitudes verificadas: permisos, creación, duplicados, cambio propio, cambio de otra cuenta, contraseñas largas y revocación de sesiones.')
