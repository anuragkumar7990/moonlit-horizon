import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'

export const dynamic = 'force-dynamic'

function getDrive() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.drive({ version: 'v3', auth: oauth2 })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })
    }

    const drive = getDrive()
    const buffer = Buffer.from(await file.arrayBuffer())
    const stream = Readable.from(buffer)

    const metadata: { name: string; parents?: string[] } = { name: file.name }
    if (process.env.DRIVE_INVOICES_FOLDER_ID) {
      metadata.parents = [process.env.DRIVE_INVOICES_FOLDER_ID]
    }

    const created = await drive.files.create({
      requestBody: metadata,
      media: { mimeType: file.type || 'application/octet-stream', body: stream },
      fields: 'id,webViewLink',
      supportsAllDrives: true,
    })

    const fileId = created.data.id!
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    })

    return NextResponse.json({ url: created.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view` })
  } catch (err) {
    console.error('[upload-attachment]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
