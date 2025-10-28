declare module 'react-calendar-heatmap' {
  import * as React from 'react';

  export type CalendarHeatmapDatum = {
    date: string | Date;
    [key: string]: unknown;
  };

  export interface CalendarHeatmapProps<T extends CalendarHeatmapDatum = CalendarHeatmapDatum> {
    startDate: Date | string;
    endDate: Date | string;
    values: T[];
    classForValue?: (value: T | null) => string;
    tooltipDataAttrs?: (value: T | null) => Record<string, string | number> | undefined;
    onClick?: (value: T | null) => void;
    showWeekdayLabels?: boolean;
    horizontal?: boolean;
    gutterSize?: number;
  }

  export default class CalendarHeatmap<T extends CalendarHeatmapDatum = CalendarHeatmapDatum> extends React.Component<CalendarHeatmapProps<T>> {}
}
