export default function Verify() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-4">
      <h1 className="text-3xl font-bold mb-4">Account Verification</h1>
      <p className="mb-6">
        First-time users must verify their account with an administrator.
      </p>
      {/* Placeholder verify form */}
      <button className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold">
        Verify Account
      </button>
    </div>
  );
}