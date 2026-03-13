export interface Template {
  id: string
  name: string
  description: string
  icon: string
  content: string
}

export const TEMPLATES: Template[] = [
  {
    id: 'meeting',
    name: 'Meeting Notes',
    description: 'Agenda, discussion points, action items',
    icon: '📋',
    content: '<h2>Meeting Notes</h2><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><h3>Agenda</h3><ul><li><p></p></li></ul><h3>Discussion</h3><p></p><h3>Action Items</h3><ul><li><p></p></li></ul>',
  },
  {
    id: 'daily',
    name: 'Daily Journal',
    description: 'Reflect on your day',
    icon: '📔',
    content: '<h2>Daily Journal</h2><p><strong>Date:</strong> </p><h3>Today I accomplished</h3><ul><li><p></p></li></ul><h3>What I learned</h3><p></p><h3>Tomorrow\'s priorities</h3><ul><li><p></p></li></ul>',
  },
  {
    id: 'project',
    name: 'Project Brief',
    description: 'Goals, timeline, and scope',
    icon: '🚀',
    content: '<h2>Project Brief</h2><h3>Overview</h3><p></p><h3>Goals</h3><ul><li><p></p></li></ul><h3>Scope</h3><p></p><h3>Timeline</h3><p></p><h3>Stakeholders</h3><ul><li><p></p></li></ul>',
  },
  {
    id: 'todo',
    name: 'To-Do List',
    description: 'Simple task checklist',
    icon: '✅',
    content: '<h2>To-Do</h2><p></p><ul><li><p>Task one</p></li><li><p>Task two</p></li><li><p>Task three</p></li></ul>',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Capture ideas freely',
    icon: '💡',
    content: '<h2>Brainstorm</h2><p><em>Topic: </em></p><h3>Ideas</h3><ul><li><p></p></li></ul><h3>Explore Further</h3><ul><li><p></p></li></ul>',
  },
]
