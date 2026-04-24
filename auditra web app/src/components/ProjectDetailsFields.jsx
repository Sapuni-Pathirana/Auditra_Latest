import { Grid, MenuItem, TextField, InputAdornment } from '@mui/material';

export default function ProjectDetailsFields({
  form,
  onChange,
  startDateRequired = false,
  endDateRequired = false,
  startDateMin,
  endDateMin,
  startDateError,
  startDateHelperText,
  endDateError,
  endDateHelperText,
  estimatedValueError,
  estimatedValueHelperText,
  estimatedValueMin,
}) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField fullWidth label="Project Title" name="title" value={form.title} onChange={onChange} required />
      </Grid>
      <Grid item xs={12}>
        <TextField fullWidth label="Description" name="description" value={form.description} onChange={onChange} multiline rows={3} required />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField select fullWidth label="Priority" name="priority" value={form.priority} onChange={onChange}>
          <MenuItem value="urgent">Urgent</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="low">Low</MenuItem>
        </TextField>
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Start Date"
          name="start_date"
          type="date"
          value={form.start_date}
          onChange={onChange}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: startDateMin }}
          required={startDateRequired}
          error={!!startDateError}
          helperText={startDateHelperText}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="End Date"
          name="end_date"
          type="date"
          value={form.end_date}
          onChange={onChange}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: endDateMin }}
          required={endDateRequired}
          error={!!endDateError}
          helperText={endDateHelperText}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Estimated Value (LKR)"
          name="estimated_value"
          type="number"
          value={form.estimated_value}
          onChange={onChange}
          required
          error={!!estimatedValueError}
          helperText={estimatedValueHelperText}
          InputProps={{
            startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
          }}
          inputProps={{ min: estimatedValueMin }}
        />
      </Grid>
    </Grid>
  );
}
