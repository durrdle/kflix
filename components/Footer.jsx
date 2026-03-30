<div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
  <Link href="/Terms-and-Conditions" className="cursor-pointer transition hover:text-red-400">
    Terms and Conditions
  </Link>
  <span>•</span>
  <Link href="/Privacy-Policy" className="cursor-pointer transition hover:text-red-400">
    Privacy Policy
  </Link>
  <span>•</span>
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