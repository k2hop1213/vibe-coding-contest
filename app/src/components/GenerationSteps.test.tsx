import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import GenerationSteps from './GenerationSteps'

test('지금 단계 표시, 지난 단계는 체크', () => {
  render(<GenerationSteps current="video" />)
  const items = screen.getAllByRole('listitem')
  expect(items.map((li) => li.textContent?.replace('→', ''))).toEqual(['✓ AI 편집', '2 영상 합치기', '3 완성'])
  expect(items[1]).toHaveAttribute('aria-current', 'step')
})
