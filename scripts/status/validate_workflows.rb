# Validate all workflow YAML and Bash run steps without executing their contents.
require 'yaml'

Dir.glob('.github/workflows/*.yml').sort.each do |path|
  workflow = YAML.load_file(path)
  workflow.fetch('jobs').each do |job_name, job|
    job.fetch('steps', []).each_with_index do |step, index|
      next unless step['run']
      script = step['run'].gsub(/\$\{\{.*?\}\}/m, 'EXPRESSION')
      IO.popen(['bash', '-n'], 'w') { |pipe| pipe.write(script) }
      abort "Invalid Bash: #{path} #{job_name} step #{index + 1}" unless $?.success?
    end
  end
  puts "YAML and bash -n OK: #{path}"
end
