import { NextResponse } from 'next/server'
import { getAllLeadsForScoring, addTagToLeads, removeTagFromLeads, type ScoringLead } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

const TOP250_TAG = 'top250'
const TOP_N = 250

// Authority score from designation string
function authorityScore(designation: string): number {
  const d = designation.toLowerCase()
  if (/\b(vp|vice president|chief|cto|coo|ceo|cfo|cso|cpo|president|founder|co-founder|md|managing director|director|head of|head -|svp|evp)\b/.test(d)) return 13
  if (/\b(manager|architect|principal|tech lead|engineering manager|delivery manager|project manager|program manager|senior manager|associate director|group manager)\b/.test(d)) return 9
  if (/\b(lead|engineer|developer|analyst|consultant|associate|specialist|advisor|staff|senior)\b/.test(d)) return 4
  return 2
}

// Priority score from P1/P2/P3 tags set during upload
function priorityScore(tags: string[]): number {
  const upper = tags.map(t => t.toUpperCase())
  if (upper.includes('P1')) return 10
  if (upper.includes('P2')) return 5
  if (upper.includes('P3')) return 2
  return 0
}

// Source quality score from Lvl 1 Source
function sourceScore(lvl1Source: string): number {
  const s = lvl1Source.toLowerCase()
  if (s.includes('referral')) return 5
  if (s.includes('event') || s.includes('webinar') || s.includes('conference')) return 3
  if (s.includes('internal') || s.includes('community')) return 2
  return 1
}

function scoreLead(lead: ScoringLead): number {
  return authorityScore(lead.designation) + priorityScore(lead.tags) + sourceScore(lead.lvl1Source)
}

export async function POST() {
  try {
    const allLeads = await getAllLeadsForScoring()

    // Only score uncalled prospects
    const prospects = allLeads.filter(l => l.leadStatus === 'Not Contacted')

    // Score + sort
    const scored = prospects
      .map(l => ({ ...l, score: scoreLead(l) }))
      .sort((a, b) => b.score - a.score)

    const top250 = scored.slice(0, TOP_N)
    const top250Ids = new Set(top250.map(l => l.id))

    // Find all leads currently tagged top250
    const currentlyTagged = allLeads.filter(l => l.tags.includes(TOP250_TAG)).map(l => l.id)

    // Remove tag from those no longer in top 250
    const toRemove = currentlyTagged.filter(id => !top250Ids.has(id))
    await removeTagFromLeads(toRemove, TOP250_TAG)

    // Add tag to new top 250 (skip those already tagged)
    const currentlyTaggedSet = new Set(currentlyTagged)
    const toAdd = top250.map(l => l.id).filter(id => !currentlyTaggedSet.has(id))
    await addTagToLeads(toAdd, TOP250_TAG)

    return NextResponse.json({
      ok: true,
      totalProspects: prospects.length,
      top250Count: top250.length,
      tagged: toAdd.length,
      untagged: toRemove.length,
      topScores: top250.slice(0, 5).map(l => ({ id: l.id, score: l.score })),
    })
  } catch (err) {
    console.error('[top-250] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
