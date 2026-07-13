export interface User {
  id?: number
  name?: string
  email?: string
  role?: string
  avatar?: string
  emailVerified?: boolean
  createdAt?: string
}

export interface AuthResponse {
  token: string
  refreshToken?: string
  user?: User
}
