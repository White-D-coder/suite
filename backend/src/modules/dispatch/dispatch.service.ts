import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class DispatchService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: any, createdById: string) {
    const { participants, tags, ...entryData } = dto;

    const entry = await this.prisma.dispatchEntry.create({
      data: {
        ...entryData,
        projectId,
        createdById,
        participants: participants?.length
          ? { create: participants.map((p: any) => ({ participantType: p.type, userId: p.userId, clientContactId: p.clientContactId, displayName: p.displayName })) }
          : undefined,
        tags: tags?.length ? { create: tags.map((t: string) => ({ tag: t })) } : undefined,
      },
      include: { participants: true, decisions: true, actionItems: true, tags: true },
    });

    return entry;
  }

  async list(projectId: string, filters: any) {
    const where: any = { projectId };
    if (filters.communicationType) where.communicationType = filters.communicationType;
    if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;
    if (filters.sentiment) where.sentiment = filters.sentiment;
    if (filters.priority) where.priority = filters.priority;
    if (filters.dateFrom) where.occurredAt = { gte: new Date(filters.dateFrom) };
    if (filters.dateTo) where.occurredAt = { ...where.occurredAt, lte: new Date(filters.dateTo) };
    if (filters.search) where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { aiSummary: { contains: filters.search, mode: 'insensitive' } },
      { rawContent: { contains: filters.search, mode: 'insensitive' } },
    ];

    return this.prisma.dispatchEntry.findMany({
      where,
      include: {
        participants: true,
        decisions: true,
        actionItems: true,
        tags: true,
      },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async getOne(id: string) {
    const entry = await this.prisma.dispatchEntry.findUnique({
      where: { id },
      include: { participants: true, decisions: true, actionItems: true, tags: true },
    });
    if (!entry) throw new NotFoundException('Dispatch entry not found');
    return entry;
  }

  async update(id: string, dto: any) {
    return this.prisma.dispatchEntry.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.prisma.dispatchEntry.delete({ where: { id } });
    return { message: 'Dispatch entry deleted' };
  }

  /** AI Summary Generation (using structured prompt — provider-agnostic) */
  async generateSummary(id: string) {
    const entry = await this.getOne(id);

    const rawContent = entry.rawContent;
    if (!rawContent) {
      await this.prisma.dispatchEntry.update({ where: { id }, data: { aiSummary: 'No content provided for summary generation.', aiConfidence: 0, verificationStatus: 'needs_review' } });
      return { message: 'No raw content available' };
    }

    // Structured AI prompt processing (provider-agnostic — uses Gemini if GEMINI_API_KEY is set, otherwise structured mock)
    let summary: string | undefined;
    let decisions: string[] = [];
    let actionItems: { action: string; person?: string; dueDate?: string }[] = [];
    let confidence = 85;

    if (process.env.GEMINI_API_KEY) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a professional business communication analyst. Analyze the following meeting/communication notes and extract a structured summary.

COMMUNICATION TITLE: ${entry.title}
DATE: ${entry.occurredAt.toISOString().split('T')[0]}
TYPE: ${entry.communicationType}

CONTENT:
${rawContent}

Respond ONLY in this exact JSON format:
{
  "summary": "2-4 sentence factual summary",
  "decisions": ["decision 1", "decision 2"],
  "actionItems": [{"action": "description", "person": "name or null", "dueDate": "YYYY-MM-DD or null"}],
  "sentiment": "positive|neutral|negative|mixed",
  "confidence": 0-100
}

Rules:
- Do NOT invent or guess any decisions or actions not clearly stated
- If content is unclear, include only what is explicitly mentioned
- Mark unclear items as "Needs confirmation"`
              }]
            }]
          })
        });
        const data = await resp.json() as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          summary = parsed.summary;
          decisions = parsed.decisions || [];
          actionItems = parsed.actionItems || [];
          confidence = parsed.confidence || 85;
          const sentiment = parsed.sentiment;
          await this.prisma.dispatchEntry.update({ where: { id }, data: { sentiment } });
        }
      } catch (e) {
        // Fall through to structured mock
      }
    }

    if (!summary) {
      // Structured extraction fallback
      const lines = rawContent.split('\n').filter(l => l.trim());
      summary = `${entry.title} — ${entry.communicationType} recorded on ${entry.occurredAt.toISOString().split('T')[0]}. ${lines.slice(0, 3).join(' ')}. AI summary requires review.`;
      confidence = 60;
    }

    // Persist summary
    await this.prisma.dispatchEntry.update({
      where: { id },
      data: { aiSummary: summary, aiConfidence: confidence, verificationStatus: 'unverified' },
    });

    // Persist extracted decisions
    if (decisions.length > 0) {
      await this.prisma.dispatchDecision.deleteMany({ where: { dispatchEntryId: id } });
      await this.prisma.dispatchDecision.createMany({ data: decisions.map(d => ({ dispatchEntryId: id, decisionText: d })) });
    }

    // Persist action items
    if (actionItems.length > 0) {
      await this.prisma.dispatchActionItem.deleteMany({ where: { dispatchEntryId: id } });
      for (const ai of actionItems) {
        await this.prisma.dispatchActionItem.create({
          data: {
            dispatchEntryId: id,
            actionText: ai.action,
            dueDate: ai.dueDate ? new Date(ai.dueDate) : undefined,
          },
        });
      }
    }

    // Notify project owner
    const project = await this.prisma.project.findUnique({ where: { id: entry.projectId }, include: { assignments: true } });
    const owners = await this.prisma.user.findMany({ where: { role: 'owner' } });
    for (const owner of owners) {
      await this.prisma.notification.create({
        data: {
          userId: owner.id,
          type: 'dispatch_ready',
          title: 'Dispatch Summary Ready for Review',
          message: `AI summary generated for "${entry.title}". Please review and verify.`,
          metadata: JSON.stringify({ dispatchId: id }),
        },
      });
    }

    return { summary, decisions, actionItems, confidence };
  }

  async verifySummary(id: string, userId: string, editedSummary?: string) {
    const entry = await this.getOne(id);
    const originalSummary = entry.aiSummary;

    await this.prisma.dispatchEntry.update({
      where: { id },
      data: {
        aiSummary: editedSummary || entry.aiSummary,
        verificationStatus: 'verified',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'dispatch_summary_verified',
        details: JSON.stringify({ dispatchId: id, originalSummary, editedSummary: editedSummary || null }),
      },
    });

    return { message: 'Summary verified' };
  }

  async createTaskFromAction(dispatchId: string, actionItemId: string) {
    const action = await this.prisma.dispatchActionItem.findUnique({ where: { id: actionItemId } });
    if (!action) throw new NotFoundException('Action item not found');

    const dispatch = await this.getOne(dispatchId);

    const task = await this.prisma.task.create({
      data: {
        projectId: dispatch.projectId,
        name: action.actionText,
        assignedTo: action.assignedUserId,
        deadline: action.dueDate,
        status: 'pending',
        comments: `Created from Dispatch entry: ${dispatch.title}`,
      },
    });

    await this.prisma.dispatchActionItem.update({ where: { id: actionItemId }, data: { linkedTaskId: task.id, status: 'in_progress' } });
    await this.prisma.auditLog.create({ data: { userId: dispatch.createdById, action: 'dispatch_action_to_task', details: `Task ${task.id} created from dispatch action ${actionItemId}` } });

    return task;
  }

  async createMilestoneFromAction(dispatchId: string, dto: { invoiceId: string; milestoneName: string; amountDue: number; dueDate?: string }) {
    const dispatch = await this.getOne(dispatchId);

    const milestone = await this.prisma.invoiceSchedule.create({
      data: {
        invoiceId: dto.invoiceId,
        milestoneName: dto.milestoneName,
        amountDue: dto.amountDue,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        paymentStatus: 'pending',
      },
    });

    return milestone;
  }

  async search(query: string, filters: any) {
    return this.prisma.dispatchEntry.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { aiSummary: { contains: query, mode: 'insensitive' } },
          { rawContent: { contains: query, mode: 'insensitive' } },
        ],
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.verificationStatus ? { verificationStatus: filters.verificationStatus } : {}),
      },
      include: { participants: true, decisions: true, actionItems: true, tags: true },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    });
  }
}
