import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

function buildConfig(values: Record<string, string> = {}): ConfigService {
  return { get: (key: string, fallback?: string) => values[key] ?? fallback } as unknown as ConfigService;
}

describe('MailService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('n’appelle pas l’API et ne lève rien quand RESEND_API_KEY est vide (no-op)', async () => {
    global.fetch = jest.fn();
    const service = new MailService(buildConfig());
    await expect(service.send({ to: 'a@example.com', subject: 'Test', html: '<p>x</p>' })).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('envoie via l’API Resend quand RESEND_API_KEY est renseigné', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new MailService(buildConfig({ RESEND_API_KEY: 'key', SMTP_FROM: 'from@example.com' }));
    await service.send({ to: 'a@example.com', subject: 'Test', html: '<p>x</p>' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer key' }),
        body: JSON.stringify({ from: 'from@example.com', to: 'a@example.com', subject: 'Test', html: '<p>x</p>' }),
      }),
    );
  });

  it('n’échoue jamais si l’envoi Resend lui-même échoue (l’action métier appelante ne doit pas planter)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Resend down')) as unknown as typeof fetch;

    const service = new MailService(buildConfig({ RESEND_API_KEY: 'key' }));
    await expect(service.send({ to: 'a@example.com', subject: 'Test', html: '<p>x</p>' })).resolves.toBeUndefined();
  });

  it('n’échoue jamais si l’API Resend répond avec une erreur HTTP', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' }) as unknown as typeof fetch;

    const service = new MailService(buildConfig({ RESEND_API_KEY: 'bad-key' }));
    await expect(service.send({ to: 'a@example.com', subject: 'Test', html: '<p>x</p>' })).resolves.toBeUndefined();
  });
});
