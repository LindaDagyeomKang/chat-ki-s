'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LeavesPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/intranet/hr') }, [router])
  return null
}
