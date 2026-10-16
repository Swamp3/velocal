import { isAllowedPushEndpoint } from './push-endpoints';

describe('push endpoints', () => {
  it('accepts the vendor push services', () => {
    expect(
      isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'),
    ).toBe(true);
    expect(
      isAllowedPushEndpoint(
        'https://updates.push.services.mozilla.com/wpush/v2/x',
      ),
    ).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/QAbc')).toBe(true);
    expect(
      isAllowedPushEndpoint(
        'https://wns2-par02p.notify.windows.com/w/?token=x',
      ),
    ).toBe(true);
  });

  it('rejects internal, plain and look-alike addresses', () => {
    for (const url of [
      'https://localhost:9/x',
      'https://backend/x',
      'https://10.0.0.5/x',
      'https://169.254.169.254/latest',
      'https://[::1]/x',
      'http://fcm.googleapis.com/x',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evilfcm.googleapis.com.attacker.io/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'not a url',
    ]) {
      expect(isAllowedPushEndpoint(url)).toBe(false);
    }
  });

  it('allows extra configured hosts', () => {
    expect(
      isAllowedPushEndpoint('https://push.example.org/x', ['push.example.org']),
    ).toBe(true);
  });
});
