'use client'

import { useEffect, useState } from 'react'
import { getMe } from '@/lib/api'

export function useUser() {
  const [userName, setUserName] = useState('')
  const [userDept, setUserDept] = useState('')
  const [userRole, setUserRole] = useState('mentee')

  useEffect(() => {
    getMe().then((me) => {
      setUserName(me.name)
      setUserDept(me.department)
      setUserRole(me.role)
    }).catch(() => {})
  }, [])

  return { userName, userDept, userRole }
}
