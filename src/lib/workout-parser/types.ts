export interface ParsedWorkoutExercise {
  name:       string;
  sets:       number;
  reps:       string;
  load?:      string;
  tempo?:     string;
  rest?:      number;
  notes?:     string;
  confidence: number;
}

export interface ParsedWorkout {
  workoutName: string;
  bodyFocus:   string;
  duration?:   number;
  notes?:      string;
  exercises:   ParsedWorkoutExercise[];
  confidence:  number;
}
