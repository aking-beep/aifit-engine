'use client'

import React, { createContext, createElement, useContext } from 'react'

/**
 * The app injects its router's link (next/link) once, at the root. Design
 * components render real anchors, so every destination is a URL: deep links,
 * middle-click and history all work.
 */
export type LinkLike = React.ComponentType<React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>

const DefaultLink: LinkLike = (props) => <a {...props} />
const LinkCtx = createContext<LinkLike>(DefaultLink)

export function LinkProvider({ component, children }: { component: LinkLike; children: React.ReactNode }) {
  return <LinkCtx.Provider value={component}>{children}</LinkCtx.Provider>
}

export function DLink(props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const Component = useContext(LinkCtx)
  return createElement(Component, props)
}
