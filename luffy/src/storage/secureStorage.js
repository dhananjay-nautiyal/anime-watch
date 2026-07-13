import { getItemAsync, setItemAsync, deleteItemAsync } from 'expo-secure-store'

export const secureStorage = {
  getToken: () => getItemAsync('token'),
  setToken: (token) => setItemAsync('token', token),
  getRefreshToken: () => getItemAsync('refreshToken'),
  setRefreshToken: (token) => setItemAsync('refreshToken', token),
  clearTokens: async () => {
    await deleteItemAsync('token')
    await deleteItemAsync('refreshToken')
  },
}
