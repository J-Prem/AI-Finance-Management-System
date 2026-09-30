import api from './api'

// Backend routes live under /teams (plural)
export const getTeams = () => api.get('/teams')
export const createTeam = (data) => api.post('/teams', data)
export const getTeam = (id) => api.get(`/teams/${id}`)
export const updateTeam = (id, data) => api.patch(`/teams/${id}`, data)

export const inviteMember = (teamId, email, role = 'member') =>
  api.post(`/teams/${teamId}/invite`, { email, role })

export const removeMember = (teamId, memberId) =>
  api.post(`/teams/${teamId}/remove-member`, { memberId })

export const updateMemberRole = (teamId, memberId, role) =>
  api.post(`/teams/${teamId}/update-member-role`, { memberId, role })

export const acceptInvitation = (teamId, token) =>
  api.post(`/teams/${teamId}/accept-invitation`, { token })

export const leaveTeam = (teamId) => api.post(`/teams/${teamId}/leave`)

export const getTeamAnalytics = (teamId) => api.get(`/teams/${teamId}/analytics`)

export default {
  getTeams, createTeam, getTeam, updateTeam,
  inviteMember, removeMember, updateMemberRole,
  acceptInvitation, leaveTeam, getTeamAnalytics,
}
