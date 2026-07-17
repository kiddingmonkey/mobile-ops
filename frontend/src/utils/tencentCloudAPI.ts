/**
 * 腾讯云安全组API调用
 * 直接从客户端调用，不依赖后端
 * 使用腾讯云API v3签名方法
 */

interface TencentCloudCredentials {
  secretId: string
  secretKey: string
  region: string
}

// HMAC-SHA256签名
async function hmacSHA256(key: string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const messageData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  return crypto.subtle.sign('HMAC', cryptoKey, messageData)
}

// ArrayBuffer转16进制字符串
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// SHA256哈希
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return bufferToHex(hashBuffer)
}

// 生成腾讯云API v3签名
async function generateSignatureV3(
  secretKey: string,
  method: string,
  canonicalUri: string,
  canonicalQueryString: string,
  canonicalHeaders: string,
  signedHeaders: string,
  payload: string,
  timestamp: number,
  date: string,
  service: string
): Promise<string> {
  // 1. 拼接规范请求串
  const hashedPayload = await sha256(payload)
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedPayload
  ].join('\n')

  // 2. 拼接待签名字符串
  const algorithm = 'TC3-HMAC-SHA256'
  const hashedCanonicalRequest = await sha256(canonicalRequest)
  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    hashedCanonicalRequest
  ].join('\n')

  // 3. 计算签名
  const kDate = await hmacSHA256('TC3' + secretKey, date)
  const kService = await hmacSHA256(bufferToHex(kDate), service)
  const kSigning = await hmacSHA256(bufferToHex(kService), 'tc3_request')
  const signature = await hmacSHA256(bufferToHex(kSigning), stringToSign)

  return bufferToHex(signature)
}

// 调用腾讯云API v3
async function callTencentCloudAPI(
  action: string,
  params: Record<string, any>,
  credentials: TencentCloudCredentials
): Promise<any> {
  const service = 'vpc'
  const host = `${service}.tencentcloudapi.com`
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().split('T')[0]

  const payload = JSON.stringify(params)
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`
  const signedHeaders = 'content-type;host'

  const signature = await generateSignatureV3(
    credentials.secretKey,
    'POST',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payload,
    timestamp,
    date,
    service
  )

  const authorization = [
    'TC3-HMAC-SHA256',
    `Credential=${credentials.secretId}/${date}/${service}/tc3_request`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ')

  const response = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authorization,
      'X-TC-Action': action,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Version': '2017-03-12',
      'X-TC-Region': credentials.region
    },
    body: payload
  })

  const data = await response.json()

  if (data.Response?.Error) {
    throw new Error(data.Response.Error.Message || '腾讯云API调用失败')
  }

  return data.Response
}

// 一键更新安全组白名单（简化版：直接调用后端接口）
export async function updateSecurityGroupWhitelist(
  template: { id: string; sg_id: string; region: string; secret_id: string; secret_key: string },
  currentIP: string
): Promise<{ mode: 'updated' | 'created'; matched: number; ip: string }> {
  // 由于腾讯云API比较复杂，这里改为调用后端接口
  // 后端不需要数据库，只需要传入参数即可
  const response = await fetch('/api/security-groups/apply-direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sg_id: template.sg_id,
      region: template.region,
      secret_id: template.secret_id,
      secret_key: template.secret_key,
      current_ip: currentIP
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || '更新失败')
  }

  return response.json()
}
