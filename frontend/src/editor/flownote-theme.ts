import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/**
 * Light mode syntax highlighting colors
 *
 * Color palette:
 * - Comments: gray (#6a737d), italic
 * - Numbers: blue (#005cc5)
 * - Strings: green (#22863a)
 * - Operators: red (#d73a49)
 * - Functions: purple (#6f42c1)
 * - Variables: dark (#24292e)
 */
export const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: tags.number, color: '#005cc5' },
  { tag: tags.string, color: '#22863a' },
  { tag: tags.operator, color: '#d73a49' },
  { tag: tags.function(tags.variableName), color: '#6f42c1' },
  { tag: tags.variableName, color: '#24292e' },
  { tag: tags.paren, color: '#24292e' },
  { tag: tags.punctuation, color: '#24292e' },
])

/**
 * Dark mode syntax highlighting colors
 *
 * Color palette:
 * - Comments: green (#6a9955), italic
 * - Numbers: light green (#b5cea8)
 * - Strings: orange (#ce9178)
 * - Operators: light gray (#d4d4d4)
 * - Functions: yellow (#dcdcaa)
 * - Variables: light blue (#9cdcfe)
 */
export const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
  { tag: tags.number, color: '#b5cea8' },
  { tag: tags.string, color: '#ce9178' },
  { tag: tags.operator, color: '#d4d4d4' },
  { tag: tags.function(tags.variableName), color: '#dcdcaa' },
  { tag: tags.variableName, color: '#9cdcfe' },
  { tag: tags.paren, color: '#d4d4d4' },
  { tag: tags.punctuation, color: '#d4d4d4' },
])

/**
 * Create syntax highlighting extension for light mode
 */
export const lightSyntaxHighlighting = syntaxHighlighting(lightHighlightStyle)

/**
 * Create syntax highlighting extension for dark mode
 */
export const darkSyntaxHighlighting = syntaxHighlighting(darkHighlightStyle)
