{options
    .filter(option => option.value !== "")
    .map(option => (
      <Select.Item key={option.value} value={option.value}>
        {option.label}
      </Select.Item>
    ))
  }