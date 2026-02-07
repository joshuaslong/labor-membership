-- Migration: Email templates for new poll and new task notifications

INSERT INTO email_templates (template_key, name, subject, html_content, description, variables) VALUES
(
  'new_poll',
  'New Poll Announcement',
  'New Poll: {poll_title}',
  '<p>Dear {name},</p>
<p>A new poll has been posted for your chapter — your input matters!</p>
<p><strong style="font-size: 18px;">{poll_title}</strong></p>
<p>{poll_description}</p>
<p><strong>Chapter:</strong> {chapter_name}</p>
<p><a href="{poll_url}" style="display: inline-block; background-color: #E25555; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Vote Now</a></p>
<p>Your voice helps shape the direction of our movement.</p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent to chapter or group members when a new poll is activated',
  '["name", "poll_title", "poll_description", "chapter_name", "poll_url"]'
),
(
  'new_task',
  'New Task Assignment',
  'New Task Assigned: {task_name}',
  '<p>Dear {name},</p>
<p>A new task has been assigned to you.</p>
<p><strong style="font-size: 18px;">{task_name}</strong></p>
<p><strong>Project:</strong> {task_project}<br>
<strong>Deliverable:</strong> {task_deliverable}<br>
<strong>Deadline:</strong> {task_deadline}<br>
<strong>Priority:</strong> {task_priority}</p>
<p><a href="{task_url}" style="display: inline-block; background-color: #E25555; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Task</a></p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent to assigned team member when a new task is created',
  '["name", "task_name", "task_deliverable", "task_project", "task_deadline", "task_priority", "task_url"]'
)
ON CONFLICT (template_key) DO NOTHING;
