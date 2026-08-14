"use client"
import { useEffect, useRef, useState } from 'react'
import { Buildings, Camera, EnvelopeSimple, LockSimple, UserCircle } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../lib/supabaseClient'
import { useAppSession } from '../../../lib/AppSessionContext'
import { useToast } from '../../../components/ui/ToastProvider'
import { Avatar } from '../../../components/ui/Avatar'
import { Field } from '../../../components/ui/Field'
import { Button } from '../../../components/ui/Button'
import type { Profile } from '../../../../supabase/types'

const MAX_AVATAR_BYTES = 3 * 1024 * 1024

export default function ProfilePage() {
  const { userId } = useAppSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileInfo, setProfileInfo] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordInfo, setPasswordInfo] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (userId) fetchProfile(userId)
  }, [userId])

  async function fetchProfile(id: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    const row = data as Profile | null
    if (row) {
      setProfile(row)
      setFullName(row.full_name ?? '')
      setCompany(row.company ?? '')
    }
  }

  async function uploadAvatar(file: File) {
    if (!userId) return
    if (!file.type.startsWith('image/')) return setProfileError('Escolha um arquivo de imagem.')
    if (file.size > MAX_AVATAR_BYTES) return setProfileError('Imagem muito grande (máximo 3 MB).')

    setProfileError(null)
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      setUploadingAvatar(false)
      return setProfileError(uploadError.message)
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = `${data.publicUrl}?t=${Date.now()}`
    const { error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId)
    setUploadingAvatar(false)
    if (error) return setProfileError(error.message)
    setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev))
    toast('Foto de perfil atualizada.')
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setProfileInfo(null)
    setProfileError(null)
    if (!fullName.trim()) return setProfileError('Digite seu nome completo.')

    setSavingProfile(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), company: company.trim() || null })
      .eq('id', userId)
    setSavingProfile(false)
    if (error) return setProfileError(error.message)
    setProfileInfo('Perfil atualizado.')
    setProfile((prev) => (prev ? { ...prev, full_name: fullName.trim(), company: company.trim() || null } : prev))
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordInfo(null)
    setPasswordError(null)
    if (newPassword.length < 8) return setPasswordError('A senha precisa ter pelo menos 8 caracteres.')
    if (!/[0-9]/.test(newPassword)) return setPasswordError('A senha precisa ter pelo menos um número.')
    if (newPassword !== confirmPassword) return setPasswordError('As senhas não coincidem.')

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) return setPasswordError(error.message)
    setPasswordInfo('Senha atualizada.')
    setNewPassword('')
    setConfirmPassword('')
  }

  if (!profile) return null

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">Perfil</h1>
      <p className="mb-8 text-sm text-muted-foreground">Suas informações pessoais e credenciais de acesso.</p>

      <div className="mb-8 flex items-center gap-4 rounded-xl border border-border bg-background p-5">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar}
          className="group relative shrink-0 rounded-full disabled:opacity-60"
          title="Trocar foto"
        >
          <Avatar name={profile.full_name || profile.email} imageUrl={profile.avatar_url} size={48} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/0 text-transparent transition-colors group-hover:bg-primary/50 group-hover:text-white">
            <Camera size={18} />
          </span>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadAvatar(file)
            e.target.value = ''
          }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{profile.full_name || profile.email}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="mt-1 text-xs text-accent hover:underline disabled:opacity-60"
          >
            {uploadingAvatar ? 'Enviando…' : 'Trocar foto'}
          </button>
        </div>
      </div>

      <form onSubmit={saveProfile} className="mb-10 flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
        <h2 className="text-sm font-medium text-primary">Informações pessoais</h2>
        <Field
          label="Nome completo"
          name="full-name"
          autoComplete="name"
          required
          icon={<UserCircle size={18} />}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Field
          label="Empresa"
          name="company"
          autoComplete="organization"
          icon={<Buildings size={18} />}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <Field label="Email" name="email" value={profile.email} icon={<EnvelopeSimple size={18} />} disabled />

        {profileInfo && (
          <p role="status" className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
            {profileInfo}
          </p>
        )}
        {profileError && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {profileError}
          </p>
        )}

        <Button type="submit" disabled={savingProfile} className="w-fit">
          {savingProfile ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>

      <form onSubmit={savePassword} className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
        <h2 className="text-sm font-medium text-primary">Alterar senha</h2>
        <Field
          label="Nova senha"
          type="password"
          name="new-password"
          autoComplete="new-password"
          minLength={8}
          icon={<LockSimple size={18} />}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Field
          label="Confirmar nova senha"
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          minLength={8}
          icon={<LockSimple size={18} />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <p className="-mt-2 text-xs text-muted-foreground">Mínimo de 8 caracteres, com pelo menos um número.</p>

        {passwordInfo && (
          <p role="status" className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
            {passwordInfo}
          </p>
        )}
        {passwordError && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {passwordError}
          </p>
        )}

        <Button type="submit" disabled={savingPassword || !newPassword} className="w-fit">
          {savingPassword ? 'Salvando…' : 'Alterar senha'}
        </Button>
      </form>
    </div>
  )
}
