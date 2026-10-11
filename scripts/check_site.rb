#!/usr/bin/env ruby
# Content and generated-site checks. Uses Ruby/YAML and Python's standard HTML parser;
# no network requests or additional gems are required.
require 'json'
require 'digest'
require 'open3'
require 'optparse'
require 'pathname'
require 'uri'
require 'yaml'

ROOT = Pathname.new(__dir__).parent.realpath
options = { site: ROOT.join('_site'), baseurl: nil, source_only: false }
OptionParser.new do |parser|
  parser.banner = 'Usage: check_site.rb [--source-only] [--site PATH] [--baseurl PATH]'
  parser.on('--source-only', 'Validate editable data without a generated site') { options[:source_only] = true }
  parser.on('--site PATH', 'Generated Jekyll output directory') { |value| options[:site] = Pathname.new(value).expand_path }
  parser.on('--baseurl PATH', 'Expected deployment subpath') { |value| options[:baseurl] = value }
end.parse!

errors = []
check = ->(condition, message) { errors << message unless condition }
string = ->(value) { value.is_a?(String) && !value.strip.empty? }
array = ->(value) { value.is_a?(Array) && !value.empty? }
require_fields = lambda do |entry, fields, label|
  unless entry.is_a?(Hash)
    errors << "#{label}: expected a mapping"
    next false
  end
  fields.each { |field| check.call(string.call(entry[field]), "#{label}: #{field} must be a nonempty string") }
  true
end
load_yaml = lambda do |path|
  YAML.safe_load(ROOT.join(path).read, aliases: true)
rescue Psych::Exception, Errno::ENOENT => error
  errors << "#{path}: #{error.message}"
  nil
end
url_check = lambda do |value, label|
  unless string.call(value)
    errors << "#{label}: URL must be a nonempty string"
    next
  end
  begin
    uri = URI.parse(value)
    check.call(%w[http https].include?(uri.scheme) && string.call(uri.host), "#{label}: expected an absolute HTTP(S) URL")
  rescue URI::InvalidURIError
    errors << "#{label}: malformed URL #{value.inspect}"
  end
end
asset_check = lambda do |value, label|
  unless string.call(value) && value.start_with?('/assets/')
    errors << "#{label}: expected a local /assets/ path"
    next
  end
  path = ROOT.join(value.delete_prefix('/')).cleanpath
  check.call(path.to_s.start_with?(ROOT.join('assets').to_s + '/') && path.file? && path.size.positive?, "#{label}: local asset does not exist or is empty: #{value}")
end

# Legacy pages remain fully scanned. Only exact historical broken references in
# byte-identical source and generated files may use the pinned exceptions.
legacy = begin
  JSON.parse(ROOT.join('scripts/legacy-links.json').read)
rescue JSON::ParserError, Errno::ENOENT => error
  errors << "legacy-links.json: #{error.message}"
  {}
end
legacy = {} unless legacy.is_a?(Hash)
check.call(legacy['baseline_commit'].is_a?(String) && legacy['baseline_commit'].match?(/\A[0-9a-f]{40}\z/), 'legacy-links.json: expected a full baseline commit SHA')
preserved_files = legacy['preserved_files']
check.call(preserved_files.is_a?(Hash) && !preserved_files.empty?, 'legacy-links.json: preserved_files must be a nonempty mapping')
preserved_files = {} unless preserved_files.is_a?(Hash)
legacy_source_matches = {}
preserved_files.each do |file, expected_hash|
  valid_path = file.is_a?(String) && !file.empty? && !file.start_with?('/') && Pathname.new(file).cleanpath.to_s == file && !file.split('/').include?('..')
  valid_hash = expected_hash.is_a?(String) && expected_hash.match?(/\A[0-9a-f]{64}\z/)
  check.call(valid_path && valid_hash, "legacy-links.json: invalid preserved path/hash for #{file.inspect}")
  next unless valid_path && valid_hash
  source = ROOT.join(file)
  legacy_source_matches[file] = source.file? && Digest::SHA256.file(source).hexdigest == expected_hash
  check.call(legacy_source_matches[file], "legacy preservation: #{file} source differs from the pinned baseline or is missing")
end
legacy_exceptions = legacy['exceptions']
check.call(legacy_exceptions.is_a?(Hash), 'legacy-links.json: exceptions must be a mapping')
legacy_exceptions = {} unless legacy_exceptions.is_a?(Hash)
redacted_url_hashes = []
legacy_exceptions.each do |file, entry|
  check.call(preserved_files.key?(file) && entry.is_a?(Hash), "legacy-links.json: exception #{file} needs a preserved file and mapping")
  next unless entry.is_a?(Hash)
  urls = entry.fetch('allowed_urls', [])
  hashes = entry.fetch('allowed_url_sha256', [])
  check.call(urls.is_a?(Array) && urls.all? { |url| string.call(url) }, "legacy-links.json: #{file} allowed_urls must be a list of strings")
  check.call(hashes.is_a?(Array) && hashes.all? { |hash| hash.is_a?(String) && hash.match?(/\A[0-9a-f]{64}\z/) }, "legacy-links.json: #{file} allowed_url_sha256 must contain SHA256 hashes")
  redacted_url_hashes.concat(hashes) if hashes.is_a?(Array)
end

config = load_yaml.call('_config.yml') || {}
check.call(config.is_a?(Hash), '_config.yml: expected a mapping')
config = {} unless config.is_a?(Hash)
profile = load_yaml.call('_data/profile.yml') || {}
check.call(profile.is_a?(Hash), '_data/profile.yml: expected a mapping')
profile = {} unless profile.is_a?(Hash)
require_fields.call(profile, %w[name role affiliation portrait], '_data/profile.yml')
check.call(array.call(profile['bio']) && profile['bio'].all? { |paragraph| string.call(paragraph) }, 'profile.bio: expected a nonempty list of nonempty paragraph strings')
asset_check.call(profile['portrait'], 'profile.portrait')
check.call(array.call(profile['links']), 'profile.links: expected at least one link')
profile_link_ids = []
Array(profile['links']).each_with_index do |link, i|
  next unless require_fields.call(link, %w[id label url], "profile.links[#{i}]")
  profile_link_ids << link['id']
  check.call(link['id'].is_a?(String) && link['id'].match?(/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/), "profile.links[#{i}]: id must be a lowercase URL-safe slug")
  url_check.call(link['url'], "profile.links[#{i}].url")
end
check.call(profile_link_ids.uniq == profile_link_ids, 'profile.links: duplicate ids')

papers = load_yaml.call('_data/publications.yml')
check.call(array.call(papers), 'publications: expected a nonempty list')
papers = [] unless papers.is_a?(Array)
ids = []
citation_keys = []
papers.each_with_index do |paper, i|
  label = "publications[#{i}]"
  next unless require_fields.call(paper, %w[id title venue description paper], label)
  ids << paper['id']
  check.call(paper['id'].is_a?(String) && paper['id'].match?(/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/), "#{label}: id must be a lowercase URL-safe slug")
  check.call(paper['year'].is_a?(Integer) && paper['year'].between?(1900, 2200), "#{label}: year must be a four-digit integer")
  check.call([true, false].include?(paper['selected']), "#{label}: selected must be true or false")
  authors = paper['authors']
  check.call(array.call(authors) && authors.all? { |author| string.call(author) }, "#{label}: authors must be a nonempty list of names")
  if authors.is_a?(Array)
    check.call(authors.uniq == authors, "#{label}: duplicate author names")
  end
  contributors = paper['contributors']
  if paper.key?('contributors')
    check.call(array.call(contributors) && contributors.all? { |name| string.call(name) }, "#{label}: contributors must be a nonempty list of names")
    check.call(contributors.uniq == contributors, "#{label}: duplicate contributor names") if contributors.is_a?(Array)
    url_check.call(paper['contributor_source'], "#{label}.contributor_source")
  elsif paper.key?('contributor_source')
    url_check.call(paper['contributor_source'], "#{label}.contributor_source")
  end
  listed_author = authors.is_a?(Array) && authors.include?(profile['name'])
  listed_contributor = contributors.is_a?(Array) && contributors.include?(profile['name'])
  check.call(listed_author || listed_contributor, "#{label}: profile.name must be listed as an author or a sourced contributor")
  if paper.key?('equal_contribution')
    equal = paper['equal_contribution']
    check.call(equal.is_a?(Array) && equal.size >= 2 && equal.uniq == equal && (equal - Array(authors)).empty?, "#{label}: equal_contribution must contain at least two distinct listed authors")
  end
  %w[paper pdf project code].each { |field| url_check.call(paper[field], "#{label}.#{field}") if paper.key?(field) }
  if paper['image']
    asset_check.call(paper['image'], "#{label}.image")
    check.call(string.call(paper['image_alt']), "#{label}: image_alt is required when image is set")
  end
  check.call(string.call(paper['bibtex']), "#{label}: bibtex must be a nonempty string when supplied") if paper.key?('bibtex')
  if paper['bibtex'].is_a?(String)
    bib = paper['bibtex']
    key = bib[/\A\s*@\w+\s*\{\s*([^,\s]+)\s*,/, 1]
    check.call(key && bib.count('{') == bib.count('}'), "#{label}: malformed BibTeX entry or unbalanced braces")
    citation_keys << key if key
    %w[title author year].each { |field| check.call(bib.match?(/\b#{field}\s*=\s*[{\"]/i), "#{label}: BibTeX missing #{field}") }
    check.call(bib.match?(/\byear\s*=\s*[{\"]#{paper['year']}[}\"]/i), "#{label}: BibTeX year differs from publication year")
  end
end
check.call(ids.uniq == ids, 'publications: duplicate ids')
check.call(citation_keys.uniq == citation_keys, 'publications: duplicate BibTeX citation keys')
check.call(papers.any? { |paper| paper.is_a?(Hash) && paper['selected'] == true }, 'publications: select at least one paper for the default view')

work = load_yaml.call('_data/work.yml')
check.call(array.call(work), 'work: expected a nonempty list')
work_ids = []
Array(work).each_with_index do |group, i|
  next unless require_fields.call(group, %w[organization period], "work[#{i}]")
  check.call(array.call(group['items']), "work[#{i}].items: expected a nonempty list")
  Array(group['items']).each_with_index do |item, j|
    label = "work[#{i}].items[#{j}]"
    next unless require_fields.call(item, %w[id title official_title description url image image_alt], label)
    work_ids << item['id']
    check.call(item['id'].is_a?(String) && item['id'].match?(/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/), "#{label}: id must be a lowercase URL-safe slug")
    if item.key?('year')
      check.call(item['year'].is_a?(Integer) && item['year'].between?(1900, 2200), "#{label}: year must be a four-digit integer when supplied")
    end
    url_check.call(item['url'], "#{label}.url")
    asset_check.call(item['image'], "#{label}.image")
    check.call([true, false].include?(item['archive']), "#{label}: archive must be true or false") if item.key?('archive')
    Array(item['links']).each_with_index do |link, k|
      next unless require_fields.call(link, %w[label url], "#{label}.links[#{k}]")
      url_check.call(link['url'], "#{label}.links[#{k}].url")
    end
  end
end
check.call(work_ids.uniq == work_ids, 'work: duplicate ids across work groups')

background = load_yaml.call('_data/background.yml') || {}
check.call(background.is_a?(Hash), '_data/background.yml: expected a mapping')
background = {} unless background.is_a?(Hash)
education = background['education']
check.call(array.call(education), 'background.education: expected a nonempty list')
education = [] unless education.is_a?(Array)
education.each_with_index do |entry, i|
  label = "background.education[#{i}]"
  next unless require_fields.call(entry, %w[id short_name institution degree gpa url], label)
  check.call(entry['year'].to_s.match?(/\A\d{4}\z/), "#{label}: year must be four digits")
  %w[distinction thesis_title].each do |field|
    check.call(string.call(entry[field]), "#{label}: #{field} must be a nonempty string when supplied") if entry.key?(field)
  end
  %w[url source thesis_url].each { |field| url_check.call(entry[field], "#{label}.#{field}") if entry.key?(field) }
end

highlights = background['highlights']
check.call(array.call(highlights), 'background.highlights: expected a nonempty list')
highlights = [] unless highlights.is_a?(Array)
highlights.each_with_index do |entry, i|
  label = "background.highlights[#{i}]"
  next unless require_fields.call(entry, %w[title icon], label)
  check.call(string.call(entry['context']), "#{label}: context must be a nonempty string when supplied") if entry.key?('context')
  check.call(entry['year'].to_s.match?(/\A\d{4}\z/), "#{label}: year must be four digits") if entry.key?('year')
  check.call(!(entry.key?('url') && entry.key?('links')), "#{label}: use either url or links, not both")
  url_check.call(entry['url'], "#{label}.url") if entry.key?('url')
  if entry.key?('links')
    check.call(array.call(entry['links']), "#{label}.links: expected a nonempty list")
    if entry['links'].is_a?(Array)
      entry['links'].each_with_index do |link, j|
        link_label = "#{label}.links[#{j}]"
        next unless require_fields.call(link, %w[label url], link_label)
        url_check.call(link['url'], "#{link_label}.url")
      end
    end
  end
end

# Retained recognition/teaching metadata is optional and is not rendered separately.
{
  'recognition' => %w[title description url],
  'teaching' => %w[course description years url]
}.each do |section, fields|
  next unless background.key?(section)
  entries = background[section]
  check.call(entries.is_a?(Array), "background.#{section}: expected a list")
  next unless entries.is_a?(Array)
  entries.each_with_index do |entry, i|
    label = "background.#{section}[#{i}]"
    next unless require_fields.call(entry, fields, label)
    url_check.call(entry['url'], "#{label}.url")
    check.call(entry['year'].to_s.match?(/\A\d{4}\z/), "#{label}: year must be four digits") unless section == 'teaching'
  end
end

# Service and talks are concise rows; source evidence stays outside the published site.
service = background.fetch('service', [])
check.call(service.is_a?(Array), 'background.service: expected a list')
service = [] unless service.is_a?(Array)
service.each_with_index do |entry, i|
  label = "background.service[#{i}]"
  next unless require_fields.call(entry, %w[role description], label)
  url_check.call(entry['url'], "#{label}.url") if entry.key?('url')
end

# Parse generated HTML with the standard library, avoiding a fragile HTML regex parser.
HTML_SCAN = <<~'PYTHON'
  import json, pathlib, sys
  from html.parser import HTMLParser
  class Scan(HTMLParser):
      def __init__(self):
          super().__init__(convert_charrefs=True)
          self.elements = []
      def handle_starttag(self, tag, attrs):
          self.elements.append({'tag': tag, 'attrs': dict(attrs), 'line': self.getpos()[0]})
      handle_startendtag = handle_starttag
  root = pathlib.Path(sys.argv[1])
  pages = {}
  for path in sorted(root.rglob('*.html')):
      scan = Scan()
      scan.feed(path.read_text(encoding='utf-8'))
      pages[path.relative_to(root).as_posix()] = scan.elements
  print(json.dumps(pages))
PYTHON

unless options[:source_only]
  site = options[:site]
  baseurl = (options[:baseurl] || config['baseurl'] || '').sub(%r{/$}, '')
  check.call(baseurl.empty? || (baseurl.start_with?('/') && !baseurl.start_with?('//')), "baseurl: expected empty or an absolute subpath, got #{baseurl.inspect}")
  check.call(site.directory? && site.join('index.html').file?, "#{site}: generated index.html missing; run scripts/build.sh first")
  if site.directory?
    legacy_build_matches = {}
    legacy_source_matches.each do |file, source_matches|
      output = site.join(file)
      output_matches = output.file? && Digest::SHA256.file(output).hexdigest == preserved_files[file]
      check.call(output_matches, "legacy preservation: #{file} generated output differs from the pinned baseline or is missing")
      legacy_build_matches[file] = source_matches && output_matches
    end
    legacy_url_allowed = lambda do |file, value|
      entry = legacy_exceptions[file]
      next false unless legacy_build_matches[file] && entry.is_a?(Hash)
      Array(entry['allowed_urls']).include?(value) || Array(entry['allowed_url_sha256']).include?(Digest::SHA256.hexdigest(value))
    end
    # These directories and files are authoring inputs, dependencies, or research provenance.
    private_dirs = %w[research scripts tests vendor node_modules .local .bundle .git _data _layouts _includes]
    private_files = %w[Gemfile Gemfile.lock package.json package-lock.json _config.yml README.md THIRD_PARTY_NOTICES.md]
    site.find do |path|
      next if path == site
      parts = path.relative_path_from(site).each_filename.to_a
      leaked = !(parts & private_dirs).empty? || private_files.include?(parts.first)
      check.call(!leaked, "build leaks internal file: #{path.relative_path_from(site)}") if path.file?
    end
    begin
      stdout, stderr, status = Open3.capture3('python3', '-c', HTML_SCAN, site.to_s)
      raise "HTML scan failed: #{stderr.strip}" unless status.success?
      documents = JSON.parse(stdout)
    rescue StandardError => error
      errors << "HTML validation: #{error.message}"
      documents = {}
    end
    document_ids = {}
    documents.each do |file, elements|
      page_ids = elements.filter_map { |element| element['attrs']['id'] }
      check.call(page_ids.all? { |id| !id.strip.empty? }, "#{file}: empty element id")
      duplicates = page_ids.tally.select { |_id, count| count > 1 }.keys
      check.call(duplicates.empty?, "#{file}: duplicate ids: #{duplicates.join(', ')}")
      document_ids[file] = page_ids
      elements.each do |element|
        attrs = element['attrs']
        %w[aria-labelledby aria-describedby aria-controls].each do |field|
          attrs.fetch(field, '').to_s.split.each do |id|
            check.call(page_ids.include?(id), "#{file}:#{element['line']}: #{field} refers to missing ##{id}")
          end
        end
        if attrs['data-citation']
          check.call(page_ids.include?("bibtex-#{attrs['data-citation']}"), "#{file}:#{element['line']}: citation button has no BibTeX template")
        end
      end
    end

    resolve = lambda do |value, file, label|
      next if value.nil?
      next if legacy_url_allowed.call(file, value)
      if value.strip.empty?
        errors << "#{label}: empty local link or asset URL"
        next
      end
      begin
        uri = URI.parse(value)
      rescue URI::InvalidURIError
        url_hash = Digest::SHA256.hexdigest(value)
        safe_value = redacted_url_hashes.include?(url_hash) ? "(legacy URL SHA256 #{url_hash})" : value.inspect
        errors << "#{label}: malformed URL #{safe_value}"
        next
      end
      if uri.scheme || uri.host
        check.call(!%w[javascript file].include?(uri.scheme), "#{label}: unsafe URL scheme")
        next
      end
      path = URI::DEFAULT_PARSER.unescape(uri.path.to_s)
      if path.start_with?('/')
        if !baseurl.empty? && path != baseurl && !path.start_with?(baseurl + '/')
          errors << "#{label}: #{value.inspect} bypasses baseurl #{baseurl.inspect}"
          next
        end
        path = path.delete_prefix(baseurl) unless baseurl.empty?
        target = site.join(path.delete_prefix('/')).cleanpath
      elsif path.empty?
        target = site.join(file)
      else
        target = site.join(file).dirname.join(path).cleanpath
      end
      unless target.to_s == site.to_s || target.to_s.start_with?(site.to_s + '/')
        errors << "#{label}: local URL escapes the generated site"
        next
      end
      target = target.join('index.html') if target.directory?
      unless target.file?
        errors << "#{label}: missing local target #{value.inspect}"
        next
      end
      if uri.fragment && !uri.fragment.empty? && target.extname == '.html'
        anchor = URI::DEFAULT_PARSER.unescape(uri.fragment)
        key = target.relative_path_from(site).to_s
        check.call(document_ids.fetch(key, []).include?(anchor), "#{label}: missing anchor ##{anchor} in #{key}")
      end
    end
    documents.each do |file, elements|
      elements.each do |element|
        attrs = element['attrs']
        %w[href src poster].each do |field|
          resolve.call(attrs[field], file, "#{file}:#{element['line']} #{field}") if attrs.key?(field)
        end
        if attrs['srcset'] && !attrs['srcset'].start_with?('data:')
          attrs['srcset'].split(',').each { |candidate| resolve.call(candidate.strip.split.first, file, "#{file}:#{element['line']} srcset") }
        end
      end
    end
    site.glob('**/*.css').each do |file|
      relative = file.relative_path_from(site).to_s
      file.read.scan(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/i).flatten.each do |url|
        resolve.call(url, relative, "#{relative} url()")
      end
    end
    rendered = documents.fetch('index.html', []).select { |element| element['attrs'].fetch('class', '').split.include?('publication') }
    expected = papers.select { |paper| paper.is_a?(Hash) }.map { |paper| "title-#{paper['id']}" }
    actual = rendered.map { |element| element['attrs']['aria-labelledby'] }
    check.call(actual.sort == expected.sort, 'index.html: rendered publications do not match the data file')
    selected_expected = papers.count { |paper| paper.is_a?(Hash) && paper['selected'] == true }
    selected_actual = rendered.count { |element| element['attrs']['data-selected'] == 'true' }
    check.call(selected_actual == selected_expected, 'index.html: selected publication flags do not match the data file')
    rendered_work = documents.fetch('index.html', []).select do |element|
      element['attrs'].fetch('class', '').split.include?('work-card')
    end
    actual_work_ids = rendered_work.map { |element| element['attrs']['data-work-id'].to_s }
    check.call(actual_work_ids.sort == work_ids.map(&:to_s).sort, 'index.html: rendered work cards do not match the data file')
    {
      'education-entry' => education,
      'recognition-item' => highlights,
      'service-item' => service
    }.each do |class_name, entries|
      rendered_count = documents.fetch('index.html', []).count do |element|
        element['attrs'].fetch('class', '').split.include?(class_name)
      end
      check.call(rendered_count == entries.size, "index.html: rendered #{class_name} rows do not match the background data file")
    end
  end
end

if errors.any?
  warn "Site checks failed (#{errors.size}):"
  errors.uniq.each { |error| warn "  - #{error}" }
  exit 1
end
if options[:source_only]
  puts "PASS: editable data, #{work_ids.size} work cards, #{papers.size} publications, #{education.size} education entries, #{highlights.size} highlights, #{service.size} service/talk rows, citation keys, and source assets."
else
  prefix = options[:baseurl] || config['baseurl'] || ''
  puts "PASS: generated pages, local links/assets, anchors, IDs, work/publication/background rendering, and output exclusions (baseurl #{prefix.empty? ? '/' : prefix})."
end
