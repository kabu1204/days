import type { PropsWithChildren } from 'react'
import { installPixelFont } from './browser/font'
import './app.scss'

installPixelFont()

export default function App({ children }: PropsWithChildren) {
  return children
}
