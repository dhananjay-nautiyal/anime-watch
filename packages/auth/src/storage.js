export function createStorage({ getItem, setItem, removeItem }) {
  return {
    getToken: () => getItem('token'),
    setToken: (token) => setItem('token', token),
    getRefreshToken: () => getItem('refreshToken'),
    setRefreshToken: (token) => setItem('refreshToken', token),
    clearTokens: async () => {
      await removeItem('token')
      await removeItem('refreshToken')
    },
  }
}
