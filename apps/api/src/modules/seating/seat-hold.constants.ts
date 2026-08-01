export const SEAT_HOLD_PREFIX = 'eventory:seat-hold:';
export const SEAT_HOLD_REQUEST_PREFIX = 'eventory:seat-hold-request:';

export const ACQUIRE_HOLDS_SCRIPT = `
for index, key in ipairs(KEYS) do
  if redis.call('EXISTS', key) == 1 then
    return 0
  end
end
for index, key in ipairs(KEYS) do
  redis.call('SET', key, ARGV[1], 'PX', ARGV[2])
end
return 1
`;

export const RELEASE_HOLDS_SCRIPT = `
local found = 0
for index, key in ipairs(KEYS) do
  local value = redis.call('GET', key)
  if value then
    found = 1
    local parsed = cjson.decode(value)
    if parsed.token ~= ARGV[1] or parsed.userId ~= ARGV[2] then
      return -1
    end
  end
end
if found == 0 then return 0 end
for index, key in ipairs(KEYS) do
  redis.call('DEL', key)
end
return 1
`;

export const RENEW_HOLDS_SCRIPT = `
for index, key in ipairs(KEYS) do
  local value = redis.call('GET', key)
  if not value then return 0 end
  local parsed = cjson.decode(value)
  if parsed.token ~= ARGV[1] or parsed.userId ~= ARGV[2] then
    return -1
  end
end
for index, key in ipairs(KEYS) do
  redis.call('SET', key, ARGV[3], 'PX', ARGV[4])
end
return 1
`;

export function seatHoldKey(eventSessionId: string, seatId: string): string {
  return `${SEAT_HOLD_PREFIX}${eventSessionId}:${seatId}`;
}

export function seatHoldRequestKey(userId: string, idempotencyKey: string): string {
  return `${SEAT_HOLD_REQUEST_PREFIX}${userId}:${idempotencyKey}`;
}
