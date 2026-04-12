---
title: How I do code reviews
date: 2026-04-12
summary: Code reviews are among the most underrated practices in software engineering — and yet almost never discussed. In this article, I share the principles I've followed for years, how the rise of generative AI has changed what I expect from authors, and why I now require full ownership of code before it lands in my review queue.
tags:
  - code-review
  - ai
---
Code reviews have always been a fundamental part of our job as developers. Unless you are working solo, reviewing code is something that some of us do on a daily basis. And yet, it is a topic that hasn't been openly discussed in about 90% of the teams that I worked with in my career. I think it's because there is a bit of a social awkwardness when it comes to reviewing and commenting on your colleague's work. 

---

## Why are code reviews important

Ever since I started doing this job, I have considered code reviews to be just as important as writing the code itself. When you look at someone else's code, you see things that people who wrote it might have missed. From simple typos, to fundamental design issues, there is always room for improvement, especially when deadlines are tight and pressure is high.
I don't know how many people realise this, but code reviews are a real gold mine. It is the one place where it is most likely to catch a nasty bug from reaching production. it is a real opportunity to express an opinion in a constructive way that can reach the entire team. And finally, it is a real learning opportunity for junior folks, but also for senior and staff people too. There are just so many good things to associate with a code review. And yet, somehow they haven't been the topic of any internal training in any of the companies I have worked for. I haven't participated in any feedback session related to code reviews. They remain one of those things that you just have to do as part of your job. 
On the other hand, bad code reviews, or not doing code reviews at all has the potential to do a great amount of harm to both people and the organisation as a whole.

---

## The social awkwardness of code reviews

Over the years, I have realised that even though code reviews add so much value, people are reluctant to do it. There are many reasons for that. First of all, code reviews take time. Time that we, as developers, rarely have to spare. Second, code reviews can be hard. Especially if the system is large and you have to review a section of the code that you have never worked on or are not familiar with. And last, but not least, code reviews can cause a certain level of tension between colleagues. Leaving comments on a PR requires technical skills, but it also requires certain level of soft skills. You need to know how to express yourself. A good code review balances between technical insights, good arguments, but also knowing the person who wrote the code you are reviewing. Some people might be sensitive to other people telling them the decisions they've made regarding the specific problem are not the right ones. Other people might feel "attacked" or "targeted" by a more senior person in the team and this might cause them to withdraw and be less active. Junior folks might feel discouraged if their code is always "criticised" without receiving constructive feedback. Inevitably, this always reflects in the team's dynamics outside of GitHub. 

---

## How I used to do code reviews

A lot of things I wrote in the previous section are purely based on observations and my personal experience. They have shaped my behaviour and my approach towards code reviews.
These are the fundamental principles that I follow:

### Am I the right person to review this code

Chances are, if your team is very small, your code base would be small too and then most people would have sufficient knowledge of the code. In my case, most of the teams I was part of were large, and we were handling large codebases with many domains. It's impossible to have sufficient knowledge in all of the domains. This is why I look into the code, decide whether I have sufficient knowledge of the domain and if I do, I agree to do it. If not, I will discuss it with my colleagues, pinpoint the person with highest level of knowledge and suggest they do the review. In case said person is pre-occupied, it is always good to discuss it with Team Lead/Manager, decide on priorities, find a way to take off one or two tasks from that person so they get some capacity for the review.

### I provide clear timelines

If I am the right person for this review, I always take a quick glance at the code and try to give an honest estimation for how much time it will take for the review. I try to be as honest as possible. Telling people "Sure, I'll take a look" and then not looking at it for a week is not polite and creates the wrong expectations.

### I try to give as many arguments as possible

I always strive to be as argumentative as possible. If I think someone has used the wrong data structure, I will say something like "I think we should use a Set here instead of a Map, because this will remove the need to check for duplicates and this will save us 15 lines of code" instead of "Use a Set here!". Providing good arguments is not just more polite and constructive for the author, but also provides good context for other reviewers. It is also a good historical reference.

### Is the current implementation properly tested

I often start my reviews with the tests. I check if tests have been written, have they been written well and do they have proper coverage. I run them locally, I spend as much time as I can afford on the tests because this allows me to understand the functionality I'm reviewing even better.

## What does increasing AI usage mean for code reviews

Before we move on with this section, I should mention that I am opposed to the usage of AI tools by junior developers. There are many reasons for that and I'm planning to dedicate a full article on this topic. Things get deeper when senior and staff engineers start using generative AI in their day-to-day work. Increased output means more code to review. Not to mention the possible decrease in quality if the code hasn't been properly vetted. 
Here comes the big reveal. I don't like, and I often refuse to do code reviews for code, written mostly with the use of AI, unless it has been properly reviewed by the author in the first place. I encourage people to take full ownership and full accountability for the code they produce. Asking AI to write code for you and then never reviewing it is actually avoiding responsibility and passing it on directly to the reviewer. If a security breach reaches production and it gets exploited by a malicious entity, who takes responsibility for it? The author, the AI, or the reviewer. Regardless, the damage is done. If the author produced bad code, where was the reviewer to stop it from reaching production? But if the reviewer was bombarded by badly written, AI-generated code, do we expect them to catch everything? If the author didn't bother vetting their code, why would we be okay of passing this responsibility to the reviewer? I don't think it's fair. 

## How I do code reviews today

To be honest, I still follow the same principles that I used to follow before, but with a caveat. If generative AI tools are being adopted by the team, I expect people to leave comments on what was generated and what not, and has it been properly vetted. The moment I spot unvetted code, unless it is something very trivial, I request changes to the code until the author performed a self-review and provided arguments on the said decisions.
