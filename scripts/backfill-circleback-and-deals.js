/**
 * Backfills HIST- rows in the Meetings sheet with:
 *   Col G: Circleback meeting URL (https://app.circleback.ai/meetings/{linkId})
 *   Col H: Zoho Deal ID (via COQL search by account name)
 */

const fs   = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
})

const { google } = require('googleapis')
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
const sheets = google.sheets({ version: 'v4', auth: oauth2 })

// ── Circleback mapping: account name (lowercase) → linkId ─────────────────────
// Built from Circleback MCP search across Jan-Jun 2026
const CIRCLEBACK = {
  'aaseya':                        'ERX77cDEAz4Mj2urC7fsV', // Rollick trainer link reused — actually AdeunQA
  'adenqa':                        '7329053',
  'adeunqa':                       '7329053',
  'ajio':                          '6779036',
  'ajio (ril)':                    '6779036',
  'akamai technologies':           '6633810',
  'alghanim industries':           '-gx2ULMqqJ1LcTJb5m9FC', // wait, that was Algoleap...
  'alghanim industries':           'eOmI4J-3kKRb4IaTSSDoC',
  'algoleap technologies':         'QelfEQZcHSmJM_1QZbrau',
  'altimetric':                    '7521083', // Betterworks training day... no
  'applied data finance':          'D7WDVG7UnpDPnjI5ntt2Y',
  'apex it':                       'NZQXjcex3WUJDQZZqAf5z',
  'arbix ai solutions':            'CzjMDO1pszR-8jsmBBywT',
  'arborgold software':            '6422425',
  'aspire systems':                '7455387',
  'barclays':                      '7628501',
  'betterworks':                   '-rfZYeV_zbQDPTVrHrj5N',
  'bloomreach':                    'deC0Yq0SyNcr4zrWI4DHI',
  'bounteous':                     '7694276',
  'bounteous x accolite':          '6570804',
  'brownbox consulting':           'gKcItC_fGxHGqAkMN8YXL',
  'byteridge':                     '6484509',
  'celestial systems':             'yN46NcsNDhRrY7Rd6QqY5',
  'cisco':                         '6871034',
  'citi':                          '7424860',
  'clario':                        '8101776',
  'clusterzap.ai':                 'vmAZLRaoniR6YIE0VwN95', // Credit Saison — need to fix
  'credit saison':                 'Z1zQsUm6thke73AfgWzfK',
  'crisil':                        '7785426',
  'coforge':                       '6458106',
  'cohesity':                      'XxC0O93WLMM8mbFupCbnB',
  'colt technology':               '7164499',
  'conga':                         '6394316',
  'contis':                        '6971336',
  'cozentus technologies':         '7488117',
  'creditsafe technology':         '6451890', // Invesco — need fix
  'essilorluxottica':              '6688222',
  'exathought':                    '7359949',
  'excelsoft technologies':        '6843243',
  'experion technologies':         '6423898', // Forsys — need fix
  'forsys inc':                    '6423898',
  'get well':                      '5tihZEWNly3lVQFtUomlI',
  'geval6':                        '6724294',
  'go high level':                 '6547103',
  'group.one':                     '7731183', // KnowledgeWorks... no need to fix
  'group.one':                     null,
  'gyan':                          '7589687',
  'hewlett packard':               'HELFfh0uxLEUFR21FWMH5', // Akshatha/Derrick — wrong; actual HP
  'hewlett packard':               'vGBiSciJnGBA6rQ4HDwG4',
  'horizontal':                    '6874337',
  'ibase-t':                       null,
  'ims group':                     '6904089',
  'in time tec':                   '7731824',
  'index engines':                 null,
  'indusface':                     'QtilX0j6Lklk3nskLnXUZ',
  'infiniti software':             '6809149',
  'infiniti software solutions':   '6809149',
  'intelligent audit':             'dRsFlV1o0QZO2Uv8epKdc',
  'invesco':                       '6451890',
  'jeavio':                        null,
  'jio platforms':                 null,
  'jmr infotech':                  'rKYfOYa8FTCZay0hT6cqi',
  'johnson controls':              null,
  'karnataka bank':                'b9uPnKB3UYaCBpPTOrDG8',
  'knowledgeworks':                '7731183',
  'kongsberg digital':             '7392662',
  'kredivo group':                 null,
  'leap':                          '6841919',
  'loginext':                      '6838428',
  'lseg':                          null,
  'lulu lemon':                    '8028665',
  'lumos labs':                    '7724110',
  'm2p fintech':                   '7190379',
  'mastek':                        'oduW1TqdhpZ14jU2YJ5Wu',
  'mastercard':                    '7695549',
  'motorola':                      '5tihZEWNly3lVQFtUomlI',
  'nasdaq':                        'Z1zQsUm6thke73AfgWzfK', // Credit Saison — need to fix
  'nasdaq':                        'FJRRrjLSVQv6kHCR2RARY', // actually Nasdaq
  'nemetschek group':              '6807042',
  'nous infoystems':               '7223648',
  'nous infosystems':              '7223648',
  'omnissa':                       null,
  'optum':                         null,
  'perfios':                       'kOwfZ3Ly3tFcOjqaXOC1D',
  'phenom':                        null,
  'piramal finance':               'Lik9IgPiQeC3AwPQub0_U',
  'prolifics':                     null,
  'prutech solutions':             '6451157',
  'pyxtech':                       '6900007',
  'qualcomm':                      null,
  'qualizeal':                     'YR2ZbOdov6bDzSdIwsJGX',
  'quorum software':               '6899236',
  'randstad enterprise':           null,
  'real page':                     null,
  'recvue':                        '7225067',
  'rollick':                       '7163530',
  'rs software':                   '7655770',
  'rxlogix':                       '6722647',
  'sedin engineering':             null,
  'shootup technologies':          '6632396',
  'sparxit':                       null,
  'squarepoint':                   null,
  'state street':                  null,
  'stryker':                       '8098097',
  't2f technology services':       null,
  'talentica software':            '6598083',
  'tarams':                        '7816603',
  'tazapay':                       '7792304',
  'titan':                         '6965370',
  'tungsten':                      '6872530',
  'tungsten automation':           '8143622',
  'turing':                        '6747413',
  'unisys':                        '7496059',
  'viasat':                        null,
  'vip (vermont information processing)': null,
  'vitech systems group':          '6606342',
  'vivicta':                       null,
  'wabtec':                        'TFSVD76nyu_axzj9_BJ4w',
  'wallethub':                     null,
  'wartsila':                      '7064407',
  'webook.com':                    null,
  'wolters kluwer':                'vmAZLRaoniR6YIE0VwN95',
  'workongrid':                    '8362893',
  'xilligence':                    '6812501',
  'zoomcar':                       'b9uPnKB3UYaCBpPTOrDG8', // Karnataka — need fix
  'zoomcar':                       '8208895',
}

// Clean mapping (deduplicated, corrected)
const CB_MAP = {
  'adeunqa':                       '7329053',
  'ajio':                          '6779036',
  'ajio (ril)':                    '6779036',
  'akamai technologies':           '6633810',
  'alghanim industries':           'eOmI4J-3kKRb4IaTSSDoC',
  'algoleap technologies':         'QelfEQZcHSmJM_1QZbrau',
  'applied data finance':          'D7WDVG7UnpDPnjI5ntt2Y',
  'apex it':                       'NZQXjcex3WUJDQZZqAf5z',
  'arbix ai solutions':            'CzjMDO1pszR-8jsmBBywT',
  'arborgold software':            '6422425',
  'aspire systems':                '7455387',
  'barclays':                      '7628501',
  'betterworks':                   '-rfZYeV_zbQDPTVrHrj5N',
  'bloomreach':                    'deC0Yq0SyNcr4zrWI4DHI',
  'bounteous':                     '7694276',
  'bounteous x accolite':          '6570804',
  'brownbox consulting':           'gKcItC_fGxHGqAkMN8YXL',
  'byteridge':                     '6484509',
  'celestial systems':             'yN46NcsNDhRrY7Rd6QqY5',
  'cisco':                         '6871034',
  'citi':                          '7424860',
  'clario':                        '8101776',
  'clario india pvt ltd':          '8101776',
  'clusterzap.ai':                 null,
  'credit saison':                 'Z1zQsUm6thke73AfgWzfK',
  'creditsafe technology':         null,
  'crisil':                        '7785426',
  'coforge':                       '6458106',
  'cohesity':                      'XxC0O93WLMM8mbFupCbnB',
  'colt technology':               '7164499',
  'conga':                         '6394316',
  'contis':                        '6971336',
  'cozentus technologies':         '7488117',
  'essilorluxottica':              '6688222',
  'essilor luxotica':              '6688222',
  'exathought':                    '7359949',
  'excelsoft technologies':        '6843243',
  'forsys inc':                    '6423898',
  'get well':                      'vGBiSciJnGBA6rQ4HDwG4',  // actually HP — let me re-check
  'geval6':                        '6724294',
  'go high level':                 '6547103',
  'gyan':                          '7589687',
  'hewlett packard':               'vGBiSciJnGBA6rQ4HDwG4',
  'horizontal':                    '6874337',
  'ims group':                     '6904089',
  'in time tec':                   '7731824',
  'indusface':                     'QtilX0j6Lklk3nskLnXUZ',
  'infiniti software':             '6809149',
  'infiniti software solutions':   '6809149',
  'intelligent audit':             'dRsFlV1o0QZO2Uv8epKdc',
  'invesco':                       '6451890',
  'jmr infotech':                  'rKYfOYa8FTCZay0hT6cqi',
  'karnataka bank':                'b9uPnKB3UYaCBpPTOrDG8',
  'knowledgeworks':                '7731183',
  'kongsberg digital':             '7392662',
  'leap':                          '6841919',
  'loginext':                      '6838428',
  'lulu lemon':                    '8028665',
  'lumos labs':                    '7724110',
  'm2p fintech':                   '7190379',
  'mastek':                        'oduW1TqdhpZ14jU2YJ5Wu',
  'mastercard':                    '7695549',
  'motorola':                      '9026000',
  'nasdaq':                        'FJRRrjLSVQv6kHCR2RARY',
  'nemetschek group':              '6807042',
  'nous infoystems':               '7223648',
  'nous infosystems':              '7223648',
  'perfios':                       'kOwfZ3Ly3tFcOjqaXOC1D',
  'piramal finance':               'Lik9IgPiQeC3AwPQub0_U',
  'prutech solutions':             '6451157',
  'pyxtech':                       '6900007',
  'qualizeal':                     'YR2ZbOdov6bDzSdIwsJGX',
  'quorum software':               '6899236',
  'recvue':                        '7225067',
  'rollick':                       '7163530',
  'rs software':                   '7655770',
  'rxlogix':                       '6722647',
  'shootup technologies':          '6632396',
  'stryker':                       '8098097',
  'talentica software':            '6598083',
  'tarams':                        '7816603',
  'tazapay':                       '7792304',
  'titan':                         '6965370',
  'tungsten':                      '6872530',
  'tungsten automation':           '8143622',
  'turing':                        '6747413',
  'unisys':                        '7496059',
  'vitech systems group':          '6606342',
  'wabtec':                        'TFSVD76nyu_axzj9_BJ4w',
  'wartsila':                      '7064407',
  'wolters kluwer':                'vmAZLRaoniR6YIE0VwN95',
  'workongrid':                    '8362893',
  'xilligence':                    '6812501',
  'zoomcar':                       '8208895',
  // Caught Before Ship
  'caught before ship':            '8649968',
  'get well':                      '8767268',
}

const CB_BASE = 'https://app.circleback.ai/meetings/'

// ── Zoho COQL ─────────────────────────────────────────────────────────────────

async function getZohoToken() {
  const res = await fetch(
    `https://accounts.zoho.in/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`)
  return data.access_token
}

// Fetch all Deals and build account name → deal ID map
async function buildDealMap(token) {
  const map = {}
  let page = 1, hasMore = true

  while (hasMore) {
    const res = await fetch(
      `https://www.zohoapis.in/crm/v2/Deals?fields=id,Deal_Name,Account_Name&page=${page}&per_page=200`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    )
    if (res.status === 204) break
    const data = await res.json()
    const deals = data.data || []

    deals.forEach(d => {
      const accName = (d.Account_Name?.name || d.Account_Name || '').toLowerCase().trim()
      if (accName && !map[accName]) map[accName] = d.id
    })

    hasMore = data.info?.more_records ?? false
    page++
    if (hasMore) await new Promise(r => setTimeout(r, 200))
  }

  return map
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Reading Meetings sheet...')
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Meetings!A:J',
  })
  const rows = res.data.values || []
  console.log(`Total rows: ${rows.length}`)

  const histRows = rows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => (row[0] || '').startsWith('HIST-'))

  console.log(`HIST- rows: ${histRows.length}`)

  // Get Zoho token and build deal map
  console.log('\nFetching all Zoho Deals...')
  const token  = await getZohoToken()
  const dealMap = await buildDealMap(token)
  console.log(`Deal map built: ${Object.keys(dealMap).length} deals`)

  const updates = []
  let cbLinked = 0, dealLinked = 0

  for (const { row, idx } of histRows) {
    const accountName = (row[1] || '').trim()
    const accountKey  = accountName.toLowerCase()
    const sheetRow    = idx + 1

    // Circleback
    const cbId  = CB_MAP[accountKey] ?? CB_MAP[accountKey.replace(/\s*\(.*?\)/, '').trim()]
    const cbUrl = cbId ? CB_BASE + cbId : ''
    if (cbUrl) cbLinked++

    // Zoho Deal — try exact, then partial match
    let dealId = dealMap[accountKey] || ''
    if (!dealId) {
      // Try matching account key as substring of deal map keys
      const match = Object.keys(dealMap).find(k => k.includes(accountKey) || accountKey.includes(k))
      if (match) dealId = dealMap[match]
    }
    if (dealId) dealLinked++

    if (cbUrl || dealId) {
      updates.push({
        range: `Meetings!G${sheetRow}:H${sheetRow}`,
        values: [[cbUrl, dealId]],
      })
    }
  }

  if (updates.length > 0) {
    console.log(`\nWriting ${updates.length} updates to sheet...`)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: updates },
    })
  }

  console.log(`\n── RESULTS ────────────────────────────────`)
  console.log(`Circleback linked: ${cbLinked} / ${histRows.length}`)
  console.log(`Zoho Deal linked:  ${dealLinked} / ${histRows.length}`)

  // Show deal map sample for debugging
  console.log('\nSample deal map (first 20):')
  Object.entries(dealMap).slice(0, 20).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
}

main().catch(err => { console.error(err); process.exit(1) })
