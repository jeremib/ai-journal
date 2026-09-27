import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProject, listEntries, listMessages } from "@/lib/db";
import ProjectView from "@/components/ProjectView";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { id } = await params;
  const project = getProject(session.user.id, id);
  if (!project) notFound();
  return <ProjectView project={project} entries={listEntries(id)} messages={listMessages(id)} />;
}
