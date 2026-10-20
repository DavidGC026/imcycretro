#!/usr/bin/env python3
"""Integration checks. Only accepts a private, synthetic loopback QA fixture."""
import hashlib
import hmac
import http.cookiejar
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

fixture_file = Path(os.environ.get('EXP_IMCYC_BRIDGE_QA_FILE', '/tmp/imcyc-exp-bridge-qa.json'))
assert fixture_file.stat().st_mode & 0o077 == 0, 'QA fixture must be private'
fixture = json.loads(fixture_file.read_text())
assert fixture.get('synthetic') is True
assert fixture['database'].startswith('imcyc_exp_bridge_qa_')
for field in ['baseUrl', 'originalUrl']:
    assert urllib.parse.urlsplit(fixture[field]).hostname in ['127.0.0.1', 'localhost', '::1']
checks = 0


def check(condition, message):
    global checks
    assert condition, message
    checks += 1


def send(request, expected=200, opener=None):
    try:
        response = (opener.open(request, timeout=65) if opener else urllib.request.urlopen(request, timeout=65))
    except urllib.error.HTTPError as error:
        response = error
    payload = response.read()
    check(response.status == expected, 'Unexpected HTTP status: ' + str(response.status) + ', expected ' + str(expected))
    return response.headers, payload


def signed(action, params=None, timestamp=None, nonce=None, secret=None):
    body = json.dumps({'action': action, 'params': {} if params is None else params}, ensure_ascii=False, separators=(',', ':')).encode()
    timestamp = str(int(time.time()) if timestamp is None else timestamp)
    nonce = secrets.token_hex(32) if nonce is None else nonce
    signature = hmac.new((secret or fixture['secret']).encode(), timestamp.encode() + b'\n' + nonce.encode() + b'\n' + body, hashlib.sha256).hexdigest()
    return urllib.request.Request(fixture['baseUrl'], data=body, headers={'Content-Type': 'application/json', 'X-IMCYC-CMS-Timestamp': timestamp, 'X-IMCYC-CMS-Nonce': nonce, 'X-IMCYC-CMS-Signature': signature})


def bridge(action, params=None, expected=200):
    headers, payload = send(signed(action, params), expected)
    check(headers.get('Set-Cookie') is None, 'Bridge must not issue original PHP session cookies')
    check('no-store' in headers.get('Cache-Control', ''), 'Bridge data must never be cached')
    return json.loads(payload)


class OriginalPanel:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = ''

    def call(self, action, body=None, expected=200, csrf=True):
        headers = {'Origin': 'http://127.0.0.1:4388'}
        if body is not None:
            headers['Content-Type'] = 'application/json'
            if csrf:
                headers['X-CSRF-Token'] = self.csrf
        request = urllib.request.Request(fixture['originalUrl'] + '?action=' + action, data=None if body is None else json.dumps(body).encode(), headers=headers)
        _, payload = send(request, expected, self.opener)
        result = json.loads(payload)
        self.csrf = result.get('csrf', self.csrf)
        return result

    def login(self, account):
        self.call('session')
        return self.call('login', {'username': account['username'], 'password': account['password']})


try:
    for method in ['GET', 'PUT', 'DELETE']:
        send(urllib.request.Request(fixture['baseUrl'], method=method), 405)
    send(urllib.request.Request(fixture['baseUrl'], data=b'{}', headers={'Content-Type': 'application/json'}), 401)
    send(signed('sheet.status', timestamp=int(time.time()) - 61), 401)
    send(signed('sheet.status', secret='different-fictitious-secret-for-rejection'), 401)
    replay = signed('sheet.status')
    headers, payload = send(replay)
    check(json.loads(payload) == {'configured': True}, 'Synthetic Sheets integration must be configured')
    check(headers.get('Set-Cookie') is None, 'Successful bridge authentication must remain sessionless')
    send(replay, 409)
    bridge('admin.users', expected=404)
    bridge('registrations.list', {'status': 'invalid'}, 422)
    bridge('registrations.detail', {'id': '1'}, 422)
    result = bridge('registrations.list')
    check(result['total'] == 32 and result['pageSize'] == 25 and len(result['registrations']) == 25, 'List pagination must retain the original contract')
    check(result['stats']['total'] == 32 and result['stats']['completed'] == 29 and result['stats']['pending'] == 3, 'Stats must describe the full dataset')
    check(len(bridge('registrations.list', {'page': 2})['registrations']) == 7, 'Second page must retain remaining rows')
    check(bridge('registrations.list', {'status': 'pending'})['total'] == 3, 'Pending contacts must remain distinguishable')
    check(bridge('registrations.list', {'search': 'qa-3@example.test'})['total'] == 1, 'Literal search must locate the synthetic contact')
    detail = bridge('registrations.detail', {'id': fixture['ids'][6]})['registration']
    check(detail['service_rating'] == 0 and detail['opinion_consent'] is None, 'Zero rating and absent consent must retain their meaning')
    check(detail['completed_at'].endswith('Z'), 'API dates must remain UTC timestamps')
    headers, workbook = send(signed('registrations.export'))
    check(headers.get_content_type() == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Export must return XLSX')
    check(int(headers['X-Export-Count']) == 32, 'Export must include every matching page')
    check(headers['Content-Disposition'].startswith('attachment; filename="registros-imcyc-'), 'Export must return a safe fixed filename')
    with zipfile.ZipFile(io.BytesIO(workbook)) as archive:
        sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        check(len(sheet.findall('.//x:row', ns)) == 33, 'Workbook must contain all rows plus header')
        check(not sheet.findall('.//x:f', ns), 'Participant text must never become spreadsheet formulas')
        check(b'=SUM(1,2)' in archive.read('xl/worksheets/sheet1.xml'), 'Formula-like contact text must remain visible text')
        check(any(c.get('r', '').startswith('I') and c.find('x:v', ns) is not None and c.find('x:v', ns).text == '0' for c in sheet.findall('.//x:c', ns)), 'XLSX must preserve numeric zero ratings')
    check(bridge('sheet.reload')['rows'] == 32, 'Sheet reload must reuse all existing records')
    deleted = bridge('registrations.delete', {'id': fixture['ids'][0]})
    check(deleted['deleted'] is True and deleted['sheetUpdated'] is True, 'Delete must also remove the mirrored row')
    bridge('registrations.detail', {'id': fixture['ids'][0]}, 404)
    check('borrar' in json.loads(Path(fixture['sheetCallsFile']).read_text().splitlines()[-1]), 'Deletion must invoke the original Sheets operation')
    Path(fixture['modeFile']).write_text('fail')
    deleted = bridge('registrations.delete', {'id': fixture['ids'][1]})
    check(deleted['deleted'] is True and deleted['sheetUpdated'] is False, 'A Sheets outage must not undo a durable database delete')
    bridge('sheet.reload', expected=502)
    Path(fixture['modeFile']).write_text('ok')
    check(bridge('sheet.reload')['rows'] == 30, 'Reload must recover the mirror after a failed row removal')
    original = OriginalPanel()
    target = OriginalPanel()
    check(original.login(fixture['original'])['authenticated'] is True, 'Original administrator login must remain operational')
    check(target.login(fixture['target'])['authenticated'] is True, 'Target administrator must have an original live session')
    original.call('admin.registrations')
    original.call('admin.users.create', {}, 403, csrf=False)
    anonymous = OriginalPanel()
    anonymous.call('admin.registrations', expected=401)
    anonymous.call('queryRegistrations', expected=404)
    users = bridge('users.list')['users']
    check(len(users) == 2 and all(user['isCurrent'] is False for user in users), 'Bridge must not impersonate an original administrator')
    check(all(set(user) == {'id', 'username', 'created_at', 'isCurrent'} for user in users), 'User listing must never expose hashes or session data')
    target_id = next(user['id'] for user in users if user['username'] == fixture['target']['username'])
    new_password = 'Ficticia-puente-segura-2026!'
    created = bridge('users.create', {'username': 'qa_bridge_new', 'password': new_password})
    check(created == {'created': True, 'username': 'qa_bridge_new'}, 'Bridge may create an original Exp administrator without impersonation')
    bridge('users.create', {'username': 'qa_bridge_new', 'password': new_password}, 409)
    bridge('users.create', {'username': 'otro_qa', 'password': 'short'}, 422)
    changed = bridge('users.password', {'id': target_id, 'password': new_password})
    check(changed == {'changed': True, 'username': fixture['target']['username']}, 'Password rotation must return only public confirmation')
    bridge('users.password', {'id': target_id, 'password': new_password}, 422)
    target.call('admin.registrations', expected=401)
    original.call('admin.registrations')
    check(target.login({'username': fixture['target']['username'], 'password': new_password})['authenticated'] is True, 'Rotated password must authenticate in the unchanged original panel')
    rate_limited = False
    for _ in range(25):
        request = signed('users.create', {'username': 'rate_qa', 'password': 'short'})
        try:
            urllib.request.urlopen(request, timeout=10)
            raise AssertionError('Invalid password unexpectedly accepted')
        except urllib.error.HTTPError as error:
            check(error.code in [422, 429], 'Rate-limited mutation must reject safely')
            rate_limited = error.code == 429
            if rate_limited:
                break
    check(rate_limited, 'Bridge administrator mutations must have their own rate limit')
    original.call('admin.registrations')
    print(str(checks) + ' local HTTP bridge checks passed; all data synthetic.')
finally:
    Path(fixture['modeFile']).write_text('ok')
    # Preserve this fixture for browser QA while clearing only its temporary rate
    # buckets. This configuration is independently restricted to loopback and QA DB.
    reset = '''require $argv[1]; $c=config(); if ($c['db_host']!=='127.0.0.1'||$c['db_port']!==3339||!str_starts_with($c['db_name'],'imcyc_exp_bridge_qa_')) exit(2); database()->exec('DELETE FROM request_limits');'''
    subprocess.run(['php', '-r', reset, str(Path(__file__).resolve().parents[1] / 'backend/bootstrap.php')], env={**os.environ, 'EXP_IMCYC_CONFIG': fixture['settingsFile']}, check=True, capture_output=True)
