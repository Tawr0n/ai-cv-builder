import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://cv:cv@db:5432/cv',
  ANTHROPIC_API_KEY: 'sk-ant-test',
};

describe('parseEnv', () => {
  it('defaults the port to 3001', () => {
    expect(parseEnv(valid).PORT).toBe(3001);
  });

  it('refuses to start without the Anthropic API key', () => {
    expect(() => parseEnv({ ...valid, ANTHROPIC_API_KEY: undefined })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });

  it('refuses a database URL that is not Postgres', () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: 'mysql://cv:cv@db:3306/cv' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('refuses a port that is not a number', () => {
    expect(() => parseEnv({ ...valid, PORT: 'http' })).toThrow(/PORT/);
  });
});
