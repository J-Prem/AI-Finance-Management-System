import { useDispatch, useSelector } from 'react-redux'
import { toggleTheme } from '../store/slices/uiSlice'

export const useDarkMode = () => {
  const dispatch = useDispatch()
  const theme = useSelector((state) => state.ui.theme)

  const isDark = theme === 'dark'

  const toggle = () => {
    dispatch(toggleTheme())
  }

  return { isDark, theme, toggle }
}
