'use client'

import { useState, useEffect, useMemo } from 'react'
import { getRecurrencePresets, buildRruleString, getOccurrences, describeRrule, detectPreset, parseEndCondition, getDayOrdinal } from '@/lib/recurrence'

const DAY_OPTIONS = [
  { key: 'SU', label: 'S', full: 'Sun' },
  { key: 'MO', label: 'M', full: 'Mon' },
  { key: 'TU', label: 'T', full: 'Tue' },
  { key: 'WE', label: 'W', full: 'Wed' },
  { key: 'TH', label: 'T', full: 'Thu' },
  { key: 'FR', label: 'F', full: 'Fri' },
  { key: 'SA', label: 'S', full: 'Sat' },
]

/**
 * RecurrenceBuilder — drop-in component for event forms.
 *
 * Props:
 *   startDate      — YYYY-MM-DD string (drives preset labels)
 *   recurrenceData — { enabled, preset, endType, endDate, count, customFreq, customInterval, customByDay, customMonthlyPosition }
 *   onChange       — (recurrenceData) => void
 *   inputClass     — CSS class for inputs
 *   labelClass     — CSS class for labels
 */
export default function RecurrenceBuilder({ startDate, recurrenceData, onChange, inputClass, labelClass }) {
  const {
    enabled = false,
    preset = 'weekly',
    endType = 'never',
    endDate = '',
    count = 12,
    customFreq = 'WEEKLY',
    customInterval = 1,
    customByDay = [],
    customMonthlyPosition = '',
  } = recurrenceData || {}

  const presets = useMemo(() => getRecurrencePresets(startDate), [startDate])

  // When start_date changes, update customByDay default and monthly position
  useEffect(() => {
    if (startDate && preset !== 'custom') {
      // Presets auto-derive from startDate, nothing to update
    }
  }, [startDate, preset])

  const update = (patch) => {
    onChange({ enabled, preset, endType, endDate, count, customFreq, customInterval, customByDay, customMonthlyPosition, ...patch })
  }

  // Build a preview RRULE to show description + upcoming dates
  const previewRrule = useMemo(() => {
    if (!enabled || !startDate) return null
    try {
      const options = { endType, endDate, count, customFreq, customInterval, customByDay, customMonthlyPosition }
      return buildRruleString(preset, startDate, options)
    } catch {
      return null
    }
  }, [enabled, startDate, preset, endType, endDate, count, customFreq, customInterval, customByDay, customMonthlyPosition])

  const previewDescription = useMemo(() => {
    if (!previewRrule || !startDate) return ''
    return describeRrule(previewRrule, startDate)
  }, [previewRrule, startDate])

  const previewDates = useMemo(() => {
    if (!previewRrule || !startDate) return []
    try {
      const end = new Date(startDate + 'T12:00:00Z')
      end.setUTCDate(end.getUTCDate() + 180)
      const endStr = end.toISOString().split('T')[0]
      return getOccurrences(previewRrule, startDate, startDate, endStr).slice(0, 4)
    } catch {
      return []
    }
  }, [previewRrule, startDate])

  const formatPreviewDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (!enabled) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="recurrence_enabled"
          checked={false}
          onChange={() => update({ enabled: true })}
          className="w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
        />
        <label htmlFor="recurrence_enabled" className="text-sm text-gray-700">Repeats</label>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="recurrence_enabled"
          checked={true}
          onChange={() => update({ enabled: false })}
          className="w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
        />
        <label htmlFor="recurrence_enabled" className="text-sm text-gray-700">Repeats</label>
      </div>

      <div className="pl-6 space-y-3 border-l-2 border-stone-200">
        {/* Preset selector */}
        <div>
          <label className={labelClass}>Repeat</label>
          <select
            value={preset}
            onChange={(e) => update({ preset: e.target.value })}
            className={inputClass}
          >
            {presets.map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Custom options */}
        {preset === 'custom' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Frequency</label>
                <select
                  value={customFreq}
                  onChange={(e) => update({ customFreq: e.target.value })}
                  className={inputClass}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="DAILY">Daily</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Every</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={customInterval}
                    onChange={(e) => update({ customInterval: parseInt(e.target.value) || 1 })}
                    className={inputClass}
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {customFreq === 'WEEKLY' ? 'week(s)' : customFreq === 'MONTHLY' ? 'month(s)' : 'day(s)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Day-of-week selector for WEEKLY */}
            {customFreq === 'WEEKLY' && (
              <div>
                <label className={labelClass}>On Days</label>
                <div className="flex gap-1">
                  {DAY_OPTIONS.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        const newDays = customByDay.includes(day.key)
                          ? customByDay.filter(d => d !== day.key)
                          : [...customByDay, day.key]
                        update({ customByDay: newDays })
                      }}
                      className={`w-8 h-8 text-xs rounded-full border transition-colors ${
                        customByDay.includes(day.key)
                          ? 'bg-labor-red text-white border-labor-red'
                          : 'bg-white text-gray-600 border-stone-200 hover:border-gray-400'
                      }`}
                      title={day.full}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly position for MONTHLY */}
            {customFreq === 'MONTHLY' && startDate && (
              <div>
                <label className={labelClass}>On Which Day</label>
                <select
                  value={customMonthlyPosition}
                  onChange={(e) => update({ customMonthlyPosition: e.target.value })}
                  className={inputClass}
                >
                  {(() => {
                    const { dayOfWeek, nth, dayName } = getDayOrdinal(startDate)
                    const ordinals = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }
                    return [
                      <option key="nth" value={`${nth}${dayOfWeek}`}>{ordinals[nth] || `${nth}th`} {dayName}</option>,
                      <option key="last" value={`-1${dayOfWeek}`}>Last {dayName}</option>,
                    ]
                  })()}
                </select>
              </div>
            )}
          </div>
        )}

        {/* End condition */}
        <div>
          <label className={labelClass}>Ends</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="recurrence_end"
                value="never"
                checked={endType === 'never'}
                onChange={() => update({ endType: 'never' })}
                className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
              />
              Never
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="recurrence_end"
                value="date"
                checked={endType === 'date'}
                onChange={() => update({ endType: 'date' })}
                className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
              />
              On date
              {endType === 'date' && (
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => update({ endDate: e.target.value })}
                  className={`${inputClass} max-w-40`}
                  min={startDate}
                />
              )}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="recurrence_end"
                value="count"
                checked={endType === 'count'}
                onChange={() => update({ endType: 'count' })}
                className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
              />
              After
              {endType === 'count' && (
                <>
                  <input
                    type="number"
                    min="2"
                    max="200"
                    value={count}
                    onChange={(e) => update({ count: parseInt(e.target.value) || 12 })}
                    className={`${inputClass} max-w-20`}
                  />
                  <span>occurrences</span>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Preview */}
        {previewDescription && (
          <div className="bg-stone-50 rounded px-3 py-2">
            <p className="text-xs text-gray-600">{previewDescription}</p>
            {previewDates.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Next: {previewDates.map(formatPreviewDate).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
