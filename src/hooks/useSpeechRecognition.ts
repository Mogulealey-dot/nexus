'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionInstance = any

interface UseSpeechRecognitionReturn {
  isRecording: boolean
  interimText: string
  isSupported: boolean
  toggle: () => void
  stop: () => void
}

export function useSpeechRecognition(
  onFinalTranscript: (text: string) => void
): UseSpeechRecognitionReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance>(null)
  const finalBufferRef = useRef('')

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    )
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsRecording(false)
    setInterimText('')
    if (finalBufferRef.current.trim()) {
      onFinalTranscript(finalBufferRef.current.trim())
      finalBufferRef.current = ''
    }
  }, [onFinalTranscript])

  const start = useCallback(() => {
    if (!isSupported) return
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition: SpeechRecognitionInstance = new SpeechRec()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    finalBufferRef.current = ''

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalBufferRef.current += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }
      setInterimText(interim)
    }

    recognition.onerror = () => {
      setIsRecording(false)
      setInterimText('')
    }

    recognition.onend = () => {
      setIsRecording(false)
      setInterimText('')
      if (finalBufferRef.current.trim()) {
        onFinalTranscript(finalBufferRef.current.trim())
        finalBufferRef.current = ''
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [isSupported, onFinalTranscript])

  const toggle = useCallback(() => {
    if (isRecording) stop()
    else start()
  }, [isRecording, start, stop])

  // Clean up on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  return { isRecording, interimText, isSupported, toggle, stop }
}
