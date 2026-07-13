export interface ApiResponse<T> {
  data?: T
  message?: string
  success?: boolean
  errorCode?: string
}

export interface PagedResponse<T> {
  data: T[]
  page: number
  totalPages: number
}

export interface PagedContent<T> {
  content: T[]
  totalPages: number
  number: number
}
