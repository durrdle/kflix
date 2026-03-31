<div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
  
  <a
    href={`${process.env.NEXT_PUBLIC_GITHUB_REPO}/commit/${process.env.NEXT_PUBLIC_COMMIT_HASH}`}
    target="_blank"
    rel="noopener noreferrer"
    className="font-mono tracking-wider text-gray-400 transition hover:text-red-400"
    title="View this version on GitHub"
  >
    {process.env.NEXT_PUBLIC_COMMIT_HASH}
  </a>
</div>