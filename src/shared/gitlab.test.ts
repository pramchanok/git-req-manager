import { expect, test, describe } from 'vitest'
import { GitLabClient } from './gitlab'

// Hack: we need to instantiate it to access private mapMR / mapUser, 
// so we cast to any for testing purposes
const client = new GitLabClient('https://gitlab.com', 'token') as any

describe('GitLabClient Mappers', () => {
  test('mapUser parses user correctly', () => {
    const rawUser = {
      id: 1,
      name: 'John Doe',
      username: 'jdoe',
      avatar_url: 'https://avatar.com',
      web_url: 'https://gitlab.com/jdoe',
      is_admin: true
    }

    const user = client.mapUser(rawUser)
    
    expect(user.id).toBe(1)
    expect(user.name).toBe('John Doe')
    expect(user.isAdmin).toBe(true)
  })

  test('mapMR handles basic mapping', () => {
    const rawMR = {
      id: 10,
      iid: 5,
      project_id: 123,
      title: 'Update dependencies',
      description: 'Fixes security issues',
      state: 'opened',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      author: { id: 1, name: 'Alice', username: 'alice' },
      source_branch: 'feat/update',
      target_branch: 'main',
      web_url: 'https://gitlab.com/repo/-/merge_requests/5',
      labels: ['bug', 'frontend']
    }

    const mr = client.mapMR(rawMR)
    
    expect(mr.id).toBe(10)
    expect(mr.projectId).toBe(123)
    expect(mr.title).toBe('Update dependencies')
    expect(mr.author.name).toBe('Alice')
    expect(mr.labels.length).toBe(2)
    expect(mr.labels[0].name).toBe('bug')
    expect(mr.labels[0].color).toBe('#6b7280') // fallback color
  })

  test('mapMR handles nulls and missing fields safely', () => {
    const rawMR = {
      id: 10,
      iid: 5,
      project_id: 123,
      title: 'Test',
      author: { id: 1, name: 'Alice' },
    }

    const mr = client.mapMR(rawMR)
    expect(mr.description).toBe('')
    expect(mr.assignees).toEqual([])
    expect(mr.labels).toEqual([])
    expect(mr.approvalsRequired).toBe(0)
  })
})
