import { useCallback, useEffect, useMemo, useState } from "react"

import { safetyNumber } from "@/lib/crypto"
import {
  clearVerifiedPeer,
  loadVerifiedPeer,
  saveVerifiedPeer,
  type VerifiedPeer,
} from "@/lib/identity-store"

export type VerificationStatus = "loading" | "missing" | "unverified" | "verified" | "changed"

export function usePeerVerification(
  localUserId: string | undefined,
  localPubKey: string | null | undefined,
  peerId: string | undefined,
  peerPubKey: string | null | undefined,
) {
  const [record, setRecord] = useState<VerifiedPeer | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!localUserId || !peerId) {
      setRecord(null)
      setLoaded(true)
      return
    }
    let cancelled = false
    setLoaded(false)
    void loadVerifiedPeer(localUserId, peerId).then((value) => {
      if (cancelled) return
      setRecord(value)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [localUserId, peerId])

  const number =
    localPubKey && peerPubKey ? safetyNumber(localPubKey, peerPubKey) : null

  const status = useMemo<VerificationStatus>(() => {
    if (!loaded) return "loading"
    if (!localPubKey || !peerPubKey) return "missing"
    if (!record) return "unverified"
    if (record.peerPubKey === peerPubKey && record.localPubKey === localPubKey) {
      return "verified"
    }
    return "changed"
  }, [loaded, localPubKey, peerPubKey, record])

  const markVerified = useCallback(async () => {
    if (!localUserId || !peerId || !localPubKey || !peerPubKey) return
    const next: VerifiedPeer = {
      peerId,
      peerPubKey,
      localPubKey,
      verifiedAt: Date.now(),
    }
    await saveVerifiedPeer(localUserId, next)
    setRecord(next)
  }, [localPubKey, localUserId, peerId, peerPubKey])

  const clearVerification = useCallback(async () => {
    if (!localUserId || !peerId) return
    await clearVerifiedPeer(localUserId, peerId)
    setRecord(null)
  }, [localUserId, peerId])

  return { status, number, record, markVerified, clearVerification }
}
