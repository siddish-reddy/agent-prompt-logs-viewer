import React, { useMemo } from 'react';

interface Event {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  type?: string;
  details?: any;
}

interface EventTimelineProps {
  events: Event[];
  width: number;
  height: number;
  onEventClick: (event: Event) => void;
  selectedEventId?: string;
}

const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  width,
  height,
  onEventClick,
  selectedEventId,
}) => {
  if (!events || events.length === 0) {
    return <div>No events to display.</div>;
  }

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.startTime - b.startTime), [events]);
  const lanes = useMemo(() => assignLanes(sortedEvents), [sortedEvents]);
  const { timeStart, timeEnd } = useMemo(() => getTimeRange(sortedEvents), [sortedEvents]);

  const totalDuration = timeEnd - timeStart;
  const gridInterval = Math.max(30000, totalDuration / 10);
  const gridCount = Math.ceil(totalDuration / gridInterval);

  const labelWidth = Math.min(250, width * 0.2);
  const padding = 20;
  const timelineWidth = width - labelWidth - padding;

  const timeToPosition = (time: number) => {
    return ((time - timeStart) / totalDuration) * timelineWidth + labelWidth;
  };

  const laneHeight = 30;
  const barHeight = 20;
  const minBarWidth = 2;

  return (
    <svg 
      width={width} 
      height={Math.max(height, lanes.length * laneHeight + padding * 2)} 
      className="event-timeline"
      style={{ backgroundColor: '#1e293b' }} // Set a dark background color
    >
      {/* Background */}
      <rect x={0} y={0} width={width} height={lanes.length * laneHeight + padding * 2} fill="#1e293b" />
      
      {/* Timeline start indicator */}
      <line x1={labelWidth} y1={0} x2={labelWidth} y2={lanes.length * laneHeight + padding * 2} stroke="#4b5563" strokeWidth="2" />
      
      {/* Grid Lines */}
      {[...Array(gridCount + 1)].map((_, i) => {
        const xPosition = timeToPosition(timeStart + i * gridInterval);
        return (
          <line
            key={`grid-${i}`}
            x1={xPosition}
            y1={padding}
            x2={xPosition}
            y2={lanes.length * laneHeight + padding}
            stroke="#4b5563"
            strokeDasharray="5,5"
          />
        );
      })}
      
      {/* Event Lanes and Bars */}
      <g transform={`translate(0, ${padding})`}>
        {lanes.map((laneEvents, laneIndex) => (
          <g key={laneIndex} transform={`translate(0, ${laneIndex * laneHeight})`}>
            {/* Lane Label */}
            <text
              x={5}
              y={laneHeight / 2}
              dominantBaseline="middle"
              fontSize={12}
              fill="#e2e8f0"
            >
              {laneEvents[0].name}
            </text>
            {/* Event Bars */}
            {laneEvents.map((event, eventIndex) => {
              const barWidth = Math.max(
                timeToPosition(event.endTime) - timeToPosition(event.startTime),
                minBarWidth
              );
              const isSelected = event.id === selectedEventId;
              const hasOverlap = laneEvents.some((otherEvent, otherIndex) => 
                eventIndex !== otherIndex &&
                event.startTime < otherEvent.endTime &&
                event.endTime > otherEvent.startTime
              );

              return (
                <g key={event.id}>
                  <rect
                    x={timeToPosition(event.startTime)}
                    y={(laneHeight - barHeight) / 2}
                    width={barWidth}
                    height={barHeight}
                    fill={getEventColor(event.name)}
                    stroke={hasOverlap ? "#ffffff" : "none"}
                    strokeWidth={0.8}
                    rx={2}
                    ry={2}
                    onClick={() => onEventClick(event)}
                    style={{ cursor: 'pointer' }}
                  >
                    <title>{`${event.name}: ${event.duration}ms`}</title>
                  </rect>
                  {isSelected && (
                    <rect
                      x={timeToPosition(event.startTime) - 2}
                      y={(laneHeight - barHeight) / 2 - 2}
                      width={barWidth + 4}
                      height={barHeight + 4}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2"
                      rx={3}
                      ry={3}
                    />
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </g>
    </svg>
  );
};

// Assign events to lanes (one lane per unique event name)
function assignLanes(events: Event[]): Event[][] {
    const laneMap: { [key: string]: Event[] } = {};
  
    events.forEach((event) => {
      if (!laneMap[event.name]) {
        laneMap[event.name] = [];
      }
      laneMap[event.name].push(event);
    });
  
    return Object.values(laneMap);
  }  

function getTimeRange(events: Event[]): { timeStart: number; timeEnd: number } {
  if (events.length === 0) {
    const now = Date.now();
    return { timeStart: now, timeEnd: now + 1 };
  }

  const timeStart = Math.min(...events.map(e => e.startTime));
  const timeEnd = Math.max(...events.map(e => e.endTime));

  // Add a small buffer to ensure all events are visible
  const buffer = (timeEnd - timeStart) * 0.05;
  return { timeStart: timeStart - buffer, timeEnd: timeEnd + buffer };
}

function getEventColor(eventName: string): string {
    const colors = [
      '#FF5733', '#33FF57', '#3357FF', '#FF33A8', '#A833FF',
      '#FF8F33', '#33FFF2', '#F2FF33', '#FF3333', '#33FF8F',
      '#8F33FF', '#FF3380', '#33A8FF', '#A8FF33', '#FF33F2',
      '#33FFB8', '#B833FF', '#FF8333', '#33FF57', '#FF33C4',
      '#33C4FF', '#C433FF', '#FFC433', '#33FFC4',
    ];
  
    const hash = eventName.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
  
    return colors[Math.abs(hash) % colors.length];
  }
  
export default EventTimeline;