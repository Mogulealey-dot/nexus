'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { DocMeta } from '@/types'

interface Node {
  id: string
  title: string
  x: number
  y: number
  vx: number
  vy: number
  connections: number
}

interface Edge {
  source: string
  target: string
}

interface Props {
  docs: DocMeta[]
  onClose: () => void
}

export default function KnowledgeGraph({ docs, onClose }: Props) {
  const router = useRouter()
  const supabase = getSupabaseClient()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 })

  useEffect(() => {
    const update = () => setDimensions({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const buildGraph = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch text_content for each doc to find @mentions
      const { data: docsWithContent } = await supabase
        .from('docs')
        .select('id, title, text_content')
        .eq('is_archived', false)
        .in('id', docs.map(d => d.id))

      if (!docsWithContent) { setLoading(false); return }

      type DocRow = { id: string; title: string | null; text_content: string | null }
      const typedDocs = docsWithContent as DocRow[]

      const titleToId = new Map<string, string>()
      typedDocs.forEach(d => titleToId.set(d.title?.toLowerCase() || '', d.id))

      const edgeSet = new Set<string>()
      const edgeList: Edge[] = []

      typedDocs.forEach(doc => {
        const text = doc.text_content || ''
        // Find @PageTitle mentions
        const matches = text.match(/@([\w\s]+)/g) || []
        matches.forEach(match => {
          const mentioned = match.slice(1).trim().toLowerCase()
          const targetId = titleToId.get(mentioned)
          if (targetId && targetId !== doc.id) {
            const key = [doc.id, targetId].sort().join('|')
            if (!edgeSet.has(key)) {
              edgeSet.add(key)
              edgeList.push({ source: doc.id, target: targetId })
            }
          }
        })
      })

      // Count connections per node
      const connCount = new Map<string, number>()
      edgeList.forEach(e => {
        connCount.set(e.source, (connCount.get(e.source) || 0) + 1)
        connCount.set(e.target, (connCount.get(e.target) || 0) + 1)
      })

      const cx = dimensions.w / 2
      const cy = dimensions.h / 2
      const r = Math.min(cx, cy) * 0.6

      // Initial positions on a circle
      const nodeList: Node[] = typedDocs.map((doc, i) => {
        const angle = (2 * Math.PI * i) / docsWithContent.length
        return {
          id: doc.id,
          title: doc.title || 'Untitled',
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
          vx: 0,
          vy: 0,
          connections: connCount.get(doc.id) || 0,
        }
      })

      // Simple force simulation — 60 iterations
      const REPULSION = 3000
      const ATTRACTION = 0.05
      const DAMPING = 0.8
      const IDEAL_DIST = 120

      for (let iter = 0; iter < 60; iter++) {
        // Repulsion between all pairs
        for (let i = 0; i < nodeList.length; i++) {
          for (let j = i + 1; j < nodeList.length; j++) {
            const dx = nodeList[j].x - nodeList[i].x
            const dy = nodeList[j].y - nodeList[i].y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const force = REPULSION / (dist * dist)
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            nodeList[i].vx -= fx
            nodeList[i].vy -= fy
            nodeList[j].vx += fx
            nodeList[j].vy += fy
          }
        }

        // Attraction along edges
        edgeList.forEach(edge => {
          const src = nodeList.find(n => n.id === edge.source)
          const tgt = nodeList.find(n => n.id === edge.target)
          if (!src || !tgt) return
          const dx = tgt.x - src.x
          const dy = tgt.y - src.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = ATTRACTION * (dist - IDEAL_DIST)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          src.vx += fx
          src.vy += fy
          tgt.vx -= fx
          tgt.vy -= fy
        })

        // Apply velocity
        nodeList.forEach(n => {
          n.x += n.vx
          n.y += n.vy
          n.vx *= DAMPING
          n.vy *= DAMPING
          // Keep within bounds
          const margin = 80
          n.x = Math.max(margin, Math.min(dimensions.w - margin, n.x))
          n.y = Math.max(margin, Math.min(dimensions.h - margin, n.y))
        })
      }

      setNodes(nodeList)
      setEdges(edgeList)
    } finally {
      setLoading(false)
    }
  }, [docs, supabase, dimensions])

  useEffect(() => { buildGraph() }, [buildGraph])

  const handleNodeClick = (id: string) => {
    onClose()
    router.push(`/docs/${id}`)
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0d0f]/95 backdrop-blur-sm flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e22]">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-[#e8e8ed]">Knowledge Graph</span>
          <span className="text-xs text-[#4a4a55]">{nodes.length} pages · {edges.length} connections</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6b6b75] hover:bg-[#1e1e22] hover:text-[#e8e8ed] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Graph */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#7c6af7] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={dimensions.w}
          height={dimensions.h - 73}
          className="flex-1 cursor-default"
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const src = nodes.find(n => n.id === edge.source)
            const tgt = nodes.find(n => n.id === edge.target)
            if (!src || !tgt) return null
            return (
              <line
                key={i}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="#2a2a2e"
                strokeWidth={1.5}
                strokeOpacity={0.7}
              />
            )
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const hasConnections = node.connections > 0
            const radius = hasConnections ? 10 + Math.min(node.connections * 2, 14) : 8
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                className="cursor-pointer"
                onClick={() => handleNodeClick(node.id)}
              >
                <circle
                  r={radius}
                  fill={hasConnections ? '#7c6af7' : '#2a2a2e'}
                  stroke={hasConnections ? '#9080ff' : '#3a3a3f'}
                  strokeWidth={1.5}
                  className="transition-all hover:opacity-80"
                />
                <text
                  x={0}
                  y={radius + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#8a8a94"
                  className="pointer-events-none select-none"
                  style={{ fontFamily: 'sans-serif' }}
                >
                  {node.title.length > 20 ? node.title.slice(0, 20) + '…' : node.title}
                </text>
              </g>
            )
          })}
        </svg>
      )}

      {nodes.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-5xl mb-3">🕸</div>
            <p className="text-sm text-[#6b6b75]">No connections yet.</p>
            <p className="text-xs text-[#4a4a55] mt-1">Link pages using @PageTitle mentions to build your graph.</p>
          </div>
        </div>
      )}
    </div>
  )
}
