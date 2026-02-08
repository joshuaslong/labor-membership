-- Migration: Enrich poll and task email templates with additional details

-- Update poll template with question count, voting deadline, and group name
UPDATE email_templates
SET
  html_content = '<p>Dear {name},</p>
<p>A new poll has been posted — your input matters!</p>
<p><strong style="font-size: 18px;">{poll_title}</strong></p>
<p>{poll_description}</p>
<table cellpadding="0" cellspacing="0" style="width: 100%; margin: 16px 0; font-size: 14px;">
  <tr>
    <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Chapter:</strong></td>
    <td style="padding: 6px 0;">{chapter_name}</td>
  </tr>
  {poll_group_row}
  <tr>
    <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Questions:</strong></td>
    <td style="padding: 6px 0;">{question_count}</td>
  </tr>
  <tr>
    <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Voting Deadline:</strong></td>
    <td style="padding: 6px 0;">{poll_deadline}</td>
  </tr>
</table>
<p><a href="{poll_url}" style="display: inline-block; background-color: #E25555; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Vote Now</a></p>
<p>Your voice helps shape the direction of our movement.</p>
<p>In solidarity,<br>Labor Party</p>',
  variables = '["name", "poll_title", "poll_description", "chapter_name", "poll_group_row", "question_count", "poll_deadline", "poll_url"]'
WHERE template_key = 'new_poll';

-- Update task template with time estimate, skill type, and notes section
UPDATE email_templates
SET
  html_content = '<p>Dear {name},</p>
<p>A new task has been assigned to you.</p>
<p><strong style="font-size: 18px;">{task_name}</strong></p>
<table cellpadding="0" cellspacing="0" style="width: 100%; margin: 16px 0; font-size: 14px;">
  <tr>
    <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Project:</strong></td>
    <td style="padding: 6px 0;">{task_project}</td>
  </tr>
  <tr>
    <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Deliverable:</strong></td>
    <td style="padding: 6px 0;">{task_deliverable}</td>
  </tr>
  <tr>
    <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Deadline:</strong></td>
    <td style="padding: 6px 0;">{task_deadline}</td>
  </tr>
  <tr>
    <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Priority:</strong></td>
    <td style="padding: 6px 0;">{task_priority}</td>
  </tr>
  <tr>
    <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Time Estimate:</strong></td>
    <td style="padding: 6px 0;">{task_time_estimate}</td>
  </tr>
  {task_skill_row}
</table>
{task_notes_section}
<p><a href="{task_url}" style="display: inline-block; background-color: #E25555; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Task</a></p>
<p>In solidarity,<br>Labor Party</p>',
  variables = '["name", "task_name", "task_deliverable", "task_project", "task_deadline", "task_priority", "task_time_estimate", "task_skill_row", "task_notes_section", "task_url"]'
WHERE template_key = 'new_task';
