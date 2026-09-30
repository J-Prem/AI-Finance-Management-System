import { useEffect, useState } from 'react'
import Layout from '../components/common/Layout'
import { FaPlus, FaTrash, FaUserCheck, FaUsers, FaSignOutAlt } from 'react-icons/fa'
import toast from 'react-hot-toast'
import * as teamSvc from '../services/teamService'
import { useAuth } from '../hooks/useAuth'

export default function TeamPage() {
  const { user } = useAuth()
  const [teams, setTeams] = useState([])
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [team, setTeam] = useState(null)
  const [selectedTab, setSelectedTab] = useState('members')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [loading, setLoading] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')

  const loadTeams = async () => {
    setLoading(true)
    try {
      const res = await teamSvc.getTeams()
      const list = res?.data?.teams || res?.data || []
      setTeams(list)
      if (list.length && !activeTeamId) setActiveTeamId(list[0]._id || list[0].id)
    } catch (e) {
      // 404/empty is fine when user has no team yet
    } finally { setLoading(false) }
  }
  const loadTeam = async (id) => {
    if (!id) return
    try {
      const res = await teamSvc.getTeam(id)
      setTeam(res?.data?.team || res?.data || null)
    } catch (e) {
      setTeam(null)
    }
  }

  useEffect(() => { loadTeams() }, [])
  useEffect(() => { if (activeTeamId) loadTeam(activeTeamId) }, [activeTeamId])

  const handleCreate = async () => {
    if (!newTeamName.trim()) { toast.error('Team name required'); return }
    try {
      const res = await teamSvc.createTeam({ name: newTeamName.trim() })
      const t = res?.data?.team || res?.data
      toast.success('Team created')
      setNewTeamName('')
      await loadTeams()
      if (t?._id) setActiveTeamId(t._id)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Create failed')
    }
  }
  const handleInvite = async () => {
    if (!activeTeamId) { toast.error('Create or select a team first'); return }
    if (!inviteEmail) { toast.error('Email required'); return }
    try {
      await teamSvc.inviteMember(activeTeamId, inviteEmail, inviteRole)
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      loadTeam(activeTeamId)
    } catch (e) { toast.error(e?.response?.data?.message || 'Invite failed') }
  }
  const handleRemove = async (memberId) => {
    if (!confirm('Remove this member?')) return
    try {
      await teamSvc.removeMember(activeTeamId, memberId)
      toast.success('Removed')
      loadTeam(activeTeamId)
    } catch (e) { toast.error('Remove failed') }
  }
  const handleRoleChange = async (memberId, role) => {
    try {
      await teamSvc.updateMemberRole(activeTeamId, memberId, role)
      toast.success('Role updated')
      loadTeam(activeTeamId)
    } catch (e) { toast.error('Update failed') }
  }
  const handleLeave = async () => {
    if (!confirm('Leave this team?')) return
    try {
      await teamSvc.leaveTeam(activeTeamId)
      toast.success('You left the team')
      setTeam(null); setActiveTeamId(null); loadTeams()
    } catch (e) { toast.error('Leave failed') }
  }

  const members = team?.members || []
  const invitations = team?.invitations || []

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy-900 dark:text-navy-100">Team Management</h1>
          <p className="text-navy-600 dark:text-navy-400 mt-2">
            Create and collaborate with shared finance teams.
          </p>
        </div>

        <div className="card p-6 space-y-3">
          <h2 className="font-semibold">Your teams</h2>
          {teams.length ? (
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => {
                const id = t._id || t.id
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTeamId(id)}
                    className={`px-3 py-2 rounded-lg text-sm border transition ${
                      id === activeTeamId ? 'bg-primary-500 text-white border-primary-500' : 'border-navy-200 dark:border-navy-700'
                    }`}
                  >
                    <FaUsers className="inline mr-1" /> {t.name}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-navy-500">You're not in any team yet. Create one below.</p>
          )}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="New team name"
              className="input-base flex-1"
            />
            <button onClick={handleCreate} className="btn-primary"><FaPlus className="mr-2" />Create team</button>
          </div>
        </div>

        {activeTeamId && (
          <>
            <div className="flex gap-2 border-b border-navy-200 dark:border-navy-700 items-center">
              {[
                { id: 'members', label: `Members (${members.length})` },
                { id: 'invitations', label: `Invitations (${invitations.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                    selectedTab === tab.id ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-navy-600 dark:text-navy-400'
                  }`}
                >{tab.label}</button>
              ))}
              <div className="ml-auto">
                <button onClick={handleLeave} className="btn-secondary btn-sm"><FaSignOutAlt className="mr-1" /> Leave team</button>
              </div>
            </div>

            {selectedTab === 'members' && (
              <div className="space-y-6">
                <div className="card p-6">
                  <h2 className="text-lg font-semibold mb-4">Invite Team Member</h2>
                  <div className="flex flex-wrap gap-2">
                    <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@company.com" className="input-base flex-1 min-w-[200px]" />
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="input-base">
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={handleInvite} className="btn-primary"><FaPlus className="mr-2" />Invite</button>
                  </div>
                </div>

                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-navy-50 dark:bg-navy-800/50">
                        <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Role</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Joined</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const id = m.userId?._id || m.userId || m._id
                        const isMe = String(id) === String(user?._id)
                        return (
                          <tr key={id} className="border-b hover:bg-navy-50 dark:hover:bg-navy-800">
                            <td className="px-6 py-4 text-sm font-medium">{m.name || m.userId?.name || (isMe ? 'You' : '—')}</td>
                            <td className="px-6 py-4 text-sm">{m.email || m.userId?.email || '—'}</td>
                            <td className="px-6 py-4 text-sm">
                              <select
                                value={m.role || 'member'}
                                onChange={(e) => handleRoleChange(id, e.target.value)}
                                className="input-base bg-transparent border-0 text-sm"
                                disabled={m.role === 'owner'}
                              >
                                <option value="viewer">Viewer</option>
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                                <option value="owner">Owner</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-sm">{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}</td>
                            <td className="px-6 py-4">
                              {m.role !== 'owner' && !isMe && (
                                <button onClick={() => handleRemove(id)} className="text-rose-500 hover:text-rose-600"><FaTrash size={14} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {!members.length && <tr><td colSpan={5} className="px-6 py-8 text-center text-navy-500">No members yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedTab === 'invitations' && (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-navy-50 dark:bg-navy-800/50">
                      <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Role</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv._id || inv.email} className="border-b">
                        <td className="px-6 py-4 text-sm">{inv.email}</td>
                        <td className="px-6 py-4 text-sm">{inv.role || 'member'}</td>
                        <td className="px-6 py-4"><span className="badge badge-warning">{inv.status || 'Pending'}</span></td>
                        <td className="px-6 py-4 text-sm">{inv.sentAt ? new Date(inv.sentAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {!invitations.length && <tr><td colSpan={4} className="px-6 py-8 text-center text-navy-500">No pending invitations.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
