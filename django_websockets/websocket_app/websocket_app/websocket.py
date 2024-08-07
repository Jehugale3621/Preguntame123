import os
import django
import json
from asgiref.sync import sync_to_async
from django.core.paginator import Paginator

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'websocket_app.settings')
django.setup()

from new_app.models import Question, Answer  # Importa los modelos

async def websocket_application(scope, receive, send):
    page_size = 3  # Número de preguntas por página
    current_page_number = 1  # Página por defecto

    while True:
        event = await receive()

        if event['type'] == 'websocket.connect':
            await send({'type': 'websocket.accept'})
            all_questions = await sync_to_async(list)(Question.objects.all().values('id', 'text'))
            paginator = Paginator(all_questions, page_size)
            current_page = paginator.page(current_page_number)
            questions_with_responses = await get_questions_with_responses(current_page.object_list)
            await send({
                'type': 'websocket.send',
                'text': json.dumps({'status': 'Loaded questions', 'questions': questions_with_responses, 'total_pages': paginator.num_pages})
            })

        elif event['type'] == 'websocket.disconnect':
            break

        elif event['type'] == 'websocket.receive':
            data = json.loads(event['text'])

            if 'question' in data:
                question_text = data['question']
                await sync_to_async(Question.objects.create)(text=question_text)
                all_questions = await sync_to_async(list)(Question.objects.all().values('id', 'text'))
                paginator = Paginator(all_questions, page_size)
                current_page = paginator.page(current_page_number)
                questions_with_responses = await get_questions_with_responses(current_page.object_list)
                await send({
                    'type': 'websocket.send',
                    'text': json.dumps({'status': 'Question saved', 'questions': questions_with_responses, 'total_pages': paginator.num_pages})
                })

            elif 'response' in data and 'question_id' in data:
                response_text = data['response']
                question_id = data['question_id']
                parent_response_id = data.get('parent_response_id', None)
                question_exists = await sync_to_async(Question.objects.filter(id=question_id).exists)()
                if question_exists:
                    parent_response = await sync_to_async(Answer.objects.filter(id=parent_response_id).first)() if parent_response_id else None
                    await sync_to_async(Answer.objects.create)(question_id=question_id, text=response_text, parent=parent_response)
                    await send({
                        'type': 'websocket.send',
                        'text': json.dumps({'status': 'Response received', 'response': response_text, 'question_id': question_id, 'parent_response_id': parent_response_id})
                    })
                else:
                    await send({
                        'type': 'websocket.send',
                        'text': json.dumps({'status': 'Invalid question ID'})
                    })

            elif 'response_to_response' in data and 'response_to_response_id' in data:
                response_to_response_text = data['response_to_response']
                question_id = data['question_id']
                response_id = data['response_id']
                response_to_response_id = data['response_to_response_id']
                parent_response_exists = await sync_to_async(Answer.objects.filter(id=response_id).exists)()
                if parent_response_exists:
                    await sync_to_async(Answer.objects.create)(question_id=question_id, text=response_to_response_text, parent_id=response_id)
                    await send({
                        'type': 'websocket.send',
                        'text': json.dumps({'status': 'Response to response received', 'response_to_response': response_to_response_text, 'question_id': question_id, 'response_id': response_id, 'response_to_response_id': response_to_response_id})
                    })
                else:
                    await send({
                        'type': 'websocket.send',
                        'text': json.dumps({'status': 'Invalid response ID'})
                    })

            elif 'page' in data:
                page_number = data['page']
                all_questions = await sync_to_async(list)(Question.objects.all().values('id', 'text'))
                paginator = Paginator(all_questions, page_size)
                if page_number <= paginator.num_pages:
                    page = paginator.page(page_number)
                    questions_with_responses = await get_questions_with_responses(page.object_list)
                    await send({
                        'type': 'websocket.send',
                        'text': json.dumps({'status': 'Page loaded', 'questions': questions_with_responses, 'total_pages': paginator.num_pages})
                    })
                else:
                    await send({
                        'type': 'websocket.send',
                        'text': json.dumps({'status': 'Invalid page number'})
                    })

async def get_questions_with_responses(questions):
    questions_with_responses = []
    for question in questions:
        responses = await sync_to_async(list)(Answer.objects.filter(question_id=question['id']).values('id', 'text', 'parent_id'))
        responses_with_sub_responses = []
        for response in responses:
            sub_responses = await sync_to_async(list)(Answer.objects.filter(parent_id=response['id']).values('id', 'text'))
            responses_with_sub_responses.append({
                **response,
                'sub_responses': sub_responses
            })
        questions_with_responses.append({
            **question,
            'responses': responses_with_sub_responses
        })
    return questions_with_responses
